const path = require("path");
const User = require("../models/User");
const { resizeImage, deleteFile } = require("../utils/uploadMiddleware");

// PRODUCTS
exports.addProduct = async (req, res) => {
  try {
    const { title, price = 0, shopUrl, isPublic = true, sort = 0 } = req.body;

    if (!title || !shopUrl) {
      return res.status(400).json({ message: "title_and_shopUrl_required" });
    }

    // 1) Build imageUrl from either uploaded file or body
    let imageUrl = (req.body.imageUrl || "").trim();

    if (req.file) {
      const inputPath = req.file.path; // e.g. /.../uploads/08-2025/images/1692633.png
      const webpPath = inputPath.replace(path.extname(inputPath), ".webp");

      // Convert/resize -> write to webpPath
      await resizeImage(inputPath, webpPath);

      // Remove original uploaded file (png/jpg) to save space
      try {
        deleteFile(inputPath);
      } catch {}

      // Store a web-friendly relative URL like: /uploads/08-2025/images/1692633.webp
      const rel =
        "/" +
        path.relative(path.join(__dirname, ".."), webpPath).replace(/\\/g, "/"); // win paths -> posix

      imageUrl = "/" + rel.replace(/^\/+/, ""); // ensure single leading slash

      // If you prefer full absolute URL:
      // imageUrl = `${process.env.STATIC_BASE_URL || ''}${imageUrl}`;
    }

    // 2) Push into products array
    const upd = await User.findByIdAndUpdate(
      req.user._id,
      {
        $push: {
          products: {
            title: title.trim(),
            imageUrl,
            price,
            shopUrl: shopUrl.trim(),
            isPublic: !!isPublic,
            sort: Number(sort) || 0,
          },
        },
      },
      { new: true, runValidators: true, select: "products" }
    );

    const product = upd.products[upd.products.length - 1];
    return res.status(201).json({ product });
  } catch (err) {
    console.error("[addProduct] error:", err);
    return res.status(500).json({ message: "failed_to_add_product" });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    // 1) Load current product (to know existing image & validate existence)
    const owner = await User.findOne(
      { _id: req.user._id, "products._id": productId },
      { "products.$": 1 }
    );
    if (!owner || !owner.products || owner.products.length === 0) {
      return res.status(404).json({ message: "product_not_found" });
    }
    const current = owner.products[0];

    // 2) Whitelist body fields
    const allow = ["title", "imageUrl", "price", "shopUrl", "isPublic", "sort"];
    const fields = {};
    for (const [k, v] of Object.entries(req.body || {})) {
      if (allow.includes(k)) fields[k] = v;
    }

    // 3) If a new file is uploaded, convert -> webp and set fields.imageUrl
    let uploadedImageUrl = "";
    if (req.file) {
      const inputPath = req.file.path; // original (png/jpg)
      const webpPath = inputPath.replace(path.extname(inputPath), ".webp");

      await resizeImage(inputPath, webpPath); // writes webpPath
      try {
        deleteFile(inputPath);
      } catch (_) {} // drop original

      // public relative URL, e.g. /uploads/08-2025/images/123456.webp
      const relUrl =
        "/" +
        path.relative(path.join(__dirname, ".."), webpPath).replace(/\\/g, "/");
      uploadedImageUrl = "/" + relUrl.replace(/^\/+/, "");

      fields.imageUrl = uploadedImageUrl; // ensure we update it
    }

    if ("price" in fields) fields.price = Number(fields.price) || 0;

    if ("isPublic" in fields)
      fields.isPublic = [true, "true", 1, "1", "on"].includes(fields.isPublic);
    if ("sort" in fields) fields.sort = Number(fields.sort) || 0;

    // 6) Run positional update (only for provided fields)
    const $set = {};
    for (const [k, v] of Object.entries(fields)) {
      $set[`products.$.${k}`] = v;
    }

    const upd = await User.findOneAndUpdate(
      { _id: req.user._id, "products._id": productId },
      Object.keys($set).length ? { $set } : {}, // no-op if nothing to set
      { new: true, runValidators: true, select: "products" }
    );
    if (!upd) return res.status(404).json({ message: "product_not_found" });

    const product = upd.products.find(
      (p) => String(p._id) === String(productId)
    );

    // 7) If we uploaded a new file and the URL changed, delete the old local file
    if (req.file && current.imageUrl && current.imageUrl !== uploadedImageUrl) {
      try {
        // strip domain if any
        const rel = current.imageUrl.replace(/^https?:\/\/[^/]+/i, "");
        // only delete if it's from our /uploads folder
        if (/^\/?uploads\//i.test(rel)) {
          const abs = path.join(__dirname, "..", rel);
          deleteFile(abs);
        }
      } catch (e) {
        // non-fatal
        console.warn("[updateProduct] could not delete old image:", e.message);
      }
    }

    return res.json({ product });
  } catch (err) {
    console.error("[updateProduct] error:", err);
    return res.status(500).json({ message: "failed_to_update_product" });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    // 1) Fetch the product to get the image URL
    const owner = await User.findOne(
      { _id: req.user._id, "products._id": productId },
      { "products.$": 1 }
    );
    if (!owner || !owner.products || owner.products.length === 0) {
      return res.status(404).json({ message: "product_not_found" });
    }

    const imageUrl = owner.products[0].imageUrl || "";

    // 2) Pull the product
    const upd = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { products: { _id: productId } } },
      { new: true, select: "products" }
    );

    // 3) If the image is local and no longer used by other products -> delete file
    if (imageUrl) {
      // strip any absolute origin
      const rel = imageUrl.replace(/^https?:\/\/[^/]+/i, "");

      // only handle files within /uploads
      if (/^\/?uploads\//i.test(rel)) {
        // ensure not referenced by another product after removal
        const stillUsed = upd?.products?.some((p) => p.imageUrl === imageUrl);
        if (!stillUsed) {
          const abs = path.join(__dirname, "..", rel.replace(/^\/+/, ""));
          try {
            deleteFile(abs); // your helper already guards existence
          } catch (e) {
            console.warn(
              "[deleteProduct] could not delete image:",
              abs,
              e.message
            );
            // non-fatal: we still return success
          }
        }
      }
    }

    return res.json({ success: true, count: upd?.products?.length ?? 0 });
  } catch (err) {
    console.error("[deleteProduct] error:", err);
    return res.status(500).json({ message: "failed_to_delete_product" });
  }
};

// RELEASES
exports.addRelease = async (req, res) => {
  try {
    const {
      kind,
      platform,
      title,
      linkUrl,
      isPublic = true,
      sort = 0,
      releaseDate,
    } = req.body;

    if (!kind || !platform || !title || !linkUrl) {
      return res
        .status(400)
        .json({ message: "kind_platform_title_link_required" });
    }

    // 1) Build posterUrl from either uploaded file or body (fallback)
    let posterUrl = (req.body.posterUrl || "").trim();

    if (req.file) {
      const inputPath = req.file.path; // e.g. /.../uploads/08-2025/images/1692633.png
      const webpPath = inputPath.replace(path.extname(inputPath), ".webp");

      // Convert/resize -> write to webpPath (keeps <=800px width if your util does)
      await resizeImage(inputPath, webpPath);

      // Remove original uploaded file (png/jpg) to save space
      try {
        deleteFile(inputPath);
      } catch {}

      // Store a web-friendly relative URL like: /uploads/08-2025/images/1692633.webp
      const rel =
        "/" +
        path.relative(path.join(__dirname, ".."), webpPath).replace(/\\/g, "/"); // win paths -> posix

      posterUrl = "/" + rel.replace(/^\/+/, ""); // ensure single leading slash

      // If you ever need absolute: posterUrl = `${process.env.STATIC_BASE_URL || ''}${posterUrl}`;
    }

    // 2) Optional: normalize date string -> Date
    let releaseDateVal = undefined;
    if (releaseDate) {
      const d = new Date(releaseDate);
      if (!isNaN(d.getTime())) releaseDateVal = d;
    }

    // 3) Push into releases array
    const upd = await User.findByIdAndUpdate(
      req.user._id,
      {
        $push: {
          releases: {
            kind, // enum validated by schema
            platform, // enum validated by schema
            title: title.trim(),
            linkUrl: linkUrl.trim(),
            posterUrl, // newly set (file or body)
            isPublic: !!isPublic,
            sort: Number(sort) || 0,
            releaseDate: releaseDateVal,
          },
        },
      },
      { new: true, runValidators: true, select: "releases" }
    );

    const release = upd.releases[upd.releases.length - 1];
    return res.status(201).json({ release });
  } catch (err) {
    console.error("[addRelease] error:", err);
    return res.status(500).json({ message: "failed_to_add_release" });
  }
};

// update releases
exports.updateRelease = async (req, res) => {
  try {
    const { releaseId } = req.params;

    // 1) Get the current release to know the existing posterUrl
    const owner = await User.findOne(
      { _id: req.user._id, "releases._id": releaseId },
      { "releases.$": 1 }
    );
    if (!owner || !owner.releases?.length) {
      return res.status(404).json({ message: "release_not_found" });
    }
    const current = owner.releases[0];

    // 2) Whitelist fields
    const allow = [
      "kind",
      "platform",
      "title",
      "linkUrl",
      "posterUrl",
      "isPublic",
      "sort",
      "releaseDate",
    ];
    const fields = {};
    for (const [k, v] of Object.entries(req.body || {})) {
      if (allow.includes(k)) fields[k] = v;
    }

    // 3) If a new poster file is uploaded → convert to .webp and set posterUrl
    let uploadedPosterUrl = "";
    if (req.file) {
      const inputPath = req.file.path;
      const webpPath = inputPath.replace(path.extname(inputPath), ".webp");
      await resizeImage(inputPath, webpPath);
      try {
        deleteFile(inputPath);
      } catch {}

      const relUrl =
        "/" +
        path.relative(path.join(__dirname, ".."), webpPath).replace(/\\/g, "/");
      uploadedPosterUrl = "/" + relUrl.replace(/^\/+/, "");
      fields.posterUrl = uploadedPosterUrl; // ensure it updates
    } else {
      // If client didn’t send a file and didn’t intend to change posterUrl, avoid wiping it
      if (!("posterUrl" in fields) || String(fields.posterUrl).trim() === "") {
        delete fields.posterUrl; // keep old
      } else {
        fields.posterUrl = String(fields.posterUrl).trim();
      }
    }

    // 4) Normalize types
    if ("isPublic" in fields)
      fields.isPublic = [true, "true", 1, "1", "on"].includes(fields.isPublic);
    if ("sort" in fields) fields.sort = Number(fields.sort) || 0;
    if ("releaseDate" in fields) {
      const d = new Date(fields.releaseDate);
      if (!isNaN(d.getTime())) fields.releaseDate = d;
      else delete fields.releaseDate;
    }
    if ("title" in fields) fields.title = String(fields.title).trim();
    if ("linkUrl" in fields) fields.linkUrl = String(fields.linkUrl).trim();

    // 5) Build positional $set
    const $set = {};
    for (const [k, v] of Object.entries(fields)) {
      $set[`releases.$.${k}`] = v;
    }

    const upd = await User.findOneAndUpdate(
      { _id: req.user._id, "releases._id": releaseId },
      Object.keys($set).length ? { $set } : {},
      { new: true, runValidators: true, select: "releases" }
    );
    if (!upd) return res.status(404).json({ message: "release_not_found" });

    const release = upd.releases.find(
      (r) => String(r._id) === String(releaseId)
    );

    // 6) If we uploaded a new poster and it changed, delete the old local file (if under /uploads and not reused)
    if (
      req.file &&
      current.posterUrl &&
      current.posterUrl !== uploadedPosterUrl
    ) {
      const rel = current.posterUrl.replace(/^https?:\/\/[^/]+/i, "");
      if (/^\/?uploads\//i.test(rel)) {
        const stillUsed = upd.releases.some(
          (r) => r.posterUrl === current.posterUrl
        );
        if (!stillUsed) {
          const abs = path.join(__dirname, "..", rel.replace(/^\/+/, ""));
          try {
            deleteFile(abs);
          } catch (e) {
            console.warn(
              "[updateRelease] could not delete old poster:",
              e.message
            );
          }
        }
      }
    }

    return res.json({ release });
  } catch (err) {
    console.error("[updateRelease] error:", err);
    return res.status(500).json({ message: "failed_to_update_release" });
  }
};

// delete release
exports.deleteRelease = async (req, res) => {
  try {
    const { releaseId } = req.params;

    // 1) Find the release (to get poster path)
    const owner = await User.findOne(
      { _id: req.user._id, "releases._id": releaseId },
      { "releases.$": 1 }
    );
    if (!owner || !owner.releases?.length) {
      return res.status(404).json({ message: "release_not_found" });
    }
    const posterUrl = owner.releases[0].posterUrl || "";

    // 2) Remove it
    const upd = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { releases: { _id: releaseId } } },
      { new: true, select: "releases" }
    );

    // 3) Delete file if local and not referenced elsewhere
    if (posterUrl) {
      const rel = posterUrl.replace(/^https?:\/\/[^/]+/i, "");
      if (/^\/?uploads\//i.test(rel)) {
        const stillUsed = upd?.releases?.some((r) => r.posterUrl === posterUrl);
        if (!stillUsed) {
          const abs = path.join(__dirname, "..", rel.replace(/^\/+/, ""));
          await deleteFile(abs); // <-- await
        }
      }
    }

    return res.json({
      success: true,
      count: upd?.releases?.length ?? 0,
      message: "release_deleted_successfully", // optional but handy for i18n
    });
  } catch (err) {
    console.error("[deleteRelease] error:", err);
    return res.status(500).json({ message: "failed_to_delete_release" });
  }
};
