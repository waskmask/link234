const User = require("../models/User");

// PRODUCTS
exports.addProduct = async (req, res) => {
  const {
    title,
    imageUrl = "",
    price = 0,
    currency = "USD",
    shopUrl,
    isPublic = true,
    sort = 0,
  } = req.body;
  if (!title || !shopUrl)
    return res.status(400).json({ message: "title_and_shopUrl_required" });

  const upd = await User.findByIdAndUpdate(
    req.user._id,
    {
      $push: {
        products: { title, imageUrl, price, currency, shopUrl, isPublic, sort },
      },
    },
    { new: true, runValidators: true, select: "products" }
  );
  const product = upd.products[upd.products.length - 1];
  res.status(201).json({ product });
};

exports.updateProduct = async (req, res) => {
  const { productId } = req.params;
  const fields = ((b) => {
    const allow = [
      "title",
      "imageUrl",
      "price",
      "currency",
      "shopUrl",
      "isPublic",
      "sort",
    ];
    return Object.fromEntries(
      Object.entries(b).filter(([k]) => allow.includes(k))
    );
  })(req.body);

  const upd = await User.findOneAndUpdate(
    { _id: req.user._id, "products._id": productId },
    {
      $set: Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [`products.$.${k}`, v])
      ),
    },
    { new: true, runValidators: true, select: "products" }
  );
  if (!upd) return res.status(404).json({ message: "product_not_found" });
  const product = upd.products.find((p) => String(p._id) === productId);
  res.json({ product });
};

exports.deleteProduct = async (req, res) => {
  const { productId } = req.params;
  const upd = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { products: { _id: productId } } },
    { new: true, select: "products" }
  );
  res.json({ success: true, count: upd.products.length });
};

// RELEASES
exports.addRelease = async (req, res) => {
  const {
    kind,
    platform,
    title,
    linkUrl,
    posterUrl = "",
    isPublic = true,
    sort = 0,
    releaseDate,
  } = req.body;
  if (!kind || !platform || !title || !linkUrl)
    return res
      .status(400)
      .json({ message: "kind_platform_title_link_required" });

  const upd = await User.findByIdAndUpdate(
    req.user._id,
    {
      $push: {
        releases: {
          kind,
          platform,
          title,
          linkUrl,
          posterUrl,
          isPublic,
          sort,
          releaseDate,
        },
      },
    },
    { new: true, runValidators: true, select: "releases" }
  );
  const release = upd.releases[upd.releases.length - 1];
  res.status(201).json({ release });
};

exports.updateRelease = async (req, res) => {
  const { releaseId } = req.params;
  const fields = ((b) => {
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
    return Object.fromEntries(
      Object.entries(b).filter(([k]) => allow.includes(k))
    );
  })(req.body);

  const upd = await User.findOneAndUpdate(
    { _id: req.user._id, "releases._id": releaseId },
    {
      $set: Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [`releases.$.${k}`, v])
      ),
    },
    { new: true, runValidators: true, select: "releases" }
  );
  if (!upd) return res.status(404).json({ message: "release_not_found" });
  const release = upd.releases.find((r) => String(r._id) === releaseId);
  res.json({ release });
};

exports.deleteRelease = async (req, res) => {
  const { releaseId } = req.params;
  const upd = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { releases: { _id: releaseId } } },
    { new: true, select: "releases" }
  );
  res.json({ success: true, count: upd.releases.length });
};
