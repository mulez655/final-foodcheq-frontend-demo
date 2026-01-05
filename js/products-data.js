// js/products-data.js
(function () {
  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  const products = [
    {
      slug: "antrodia-mushroom",
      name: "Antrodia Mushroom",
      price: 10,
      unit: "",
      image: "images/Age-Well-Antrodia-Mushroom-Tea.jpg",
      short:
        "Age Well Antrodia Mushroom helps protect the liver and strengthen immunity with powerful antioxidants.",
      description:
        "Age Well Antrodia Mushroom harnesses the power of Antrodia cinnamomea, a rare medicinal fungus native to Taiwan and often called the “Ruby of the Forest.” Traditionally used in Taiwanese herbal medicine, Antrodia is prized for its rich concentration of triterpenoids, polysaccharides, and antioxidants. These compounds are known to help protect the liver, boost immune defenses, and reduce inflammation.",
      benefits: [
        "Supports liver health: Helps detoxify and protect liver cells from toxins.",
        "Boosts immunity: Strengthens the body’s natural defenses with polysaccharides and triterpenoids.",
        "Rich in antioxidants: Shields cells from oxidative stress and free radical damage.",
        "Anti-inflammatory properties: May reduce inflammation and support joint comfort.",
        "Enhances energy & vitality: Adaptogenic effects help fight fatigue and improve resilience.",
        "Promotes metabolic balance: Supports healthy cholesterol and blood sugar regulation.",
        "Stress support: Adaptogens help the body cope with physical and emotional stress.",
      ],
      category: "Tea",
      tags: ["immunity", "liver", "antioxidant"],
      related: ["mint", "peppermint", "lavender", "green-tea"],
    },

    // Related examples
    {
      slug: "mint",
      name: "Mint",
      price: 5,
      unit: "50g",
      image: "images/Mint-Tea.jpg",
      short: "Refreshing mint tea for digestion, clarity, and calm.",
      description:
        "Mint tea is a refreshing herbal infusion commonly used to support digestion and provide a soothing, cooling effect.",
      benefits: [
        "Supports digestion and reduces bloating.",
        "Refreshing aroma supports mental clarity.",
        "May ease nausea and stomach discomfort.",
      ],
      category: "Tea",
      tags: ["digestion", "calm"],
      related: ["peppermint", "green-tea"],
    },
    {
      slug: "peppermint",
      name: "Peppermint",
      price: 10,
      unit: "100g",
      image: "images/Peppermint-Tea.jpg",
      short: "Cooling peppermint tea known for digestive comfort.",
      description:
        "Peppermint tea is widely used for digestive comfort and a cooling sensation that feels great any time of day.",
      benefits: ["Supports digestion.", "Refreshing and soothing.", "May reduce nausea."],
      category: "Tea",
      tags: ["digestion", "fresh"],
      related: ["mint", "green-tea"],
    },
    {
      slug: "lavender",
      name: "Lavender",
      price: 15,
      unit: "120g",
      image: "images/Lavender-Tea.png",
      short: "Floral lavender tea for relaxation and better sleep routines.",
      description:
        "Lavender tea is known for its calming, floral aroma—often used to support relaxation and evening wind-down routines.",
      benefits: ["Supports relaxation.", "Helps with bedtime routines.", "Soothes tension."],
      category: "Tea",
      tags: ["sleep", "calm"],
      related: ["green-tea"],
    },
    {
      slug: "green-tea",
      name: "Green Tea",
      price: 5,
      unit: "50g",
      image: "images/Green-Tea.jpg",
      short: "Classic green tea with antioxidants for daily wellness.",
      description:
        "Green tea contains natural antioxidants and is commonly used as a daily wellness beverage.",
      benefits: ["Antioxidant support.", "Gentle energy.", "Daily wellness routine."],
      category: "Tea",
      tags: ["antioxidant", "daily"],
      related: ["mint", "peppermint"],
    },
  ].map((p) => {
    if (!p.slug) p.slug = slugify(p.name);
    return p;
  });

  const bySlug = {};
  products.forEach((p) => (bySlug[p.slug] = p));

  window.PRODUCTS_DATA = { products, bySlug };
})();
