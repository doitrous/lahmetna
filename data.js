/* Shared seed data — loaded by the browser (window.LAHMETNA_SEED) and the
   Node server (module.exports). Single source of truth for first-run seeding. */
(function (root, factory) {
  var data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.LAHMETNA_SEED = data;
})(typeof self !== 'undefined' ? self : this, function () {
  // p() packaged product, L() livestock (weight-priced)
  function p(id, vendor, cat, name, unit, price, rating, reviews, badge, stock, desc) {
    return { id: id, vendor: vendor, cat: cat, type: 'packaged', name: name, unit: unit, price: price, pricePerKg: null, weightKg: null, rating: rating, reviews: reviews, badge: badge || '', stock: stock, desc: desc };
  }
  function L(id, vendor, name, pricePerKg, weightKg, rating, reviews, badge, stock, desc) {
    return { id: id, vendor: vendor, cat: 'Livestock', type: 'livestock', name: name, unit: 'kg', price: Math.round(pricePerKg * weightKg), pricePerKg: pricePerKg, weightKg: weightKg, rating: rating, reviews: reviews, badge: badge || '', stock: stock, desc: desc };
  }

  return {
    cats: ['all', 'Beef', 'Lamb & Goat', 'Poultry', 'Eggs', 'Dairy', 'Vegetables', 'Fruit', 'Honey', 'Livestock'],

    admin: { name: 'Lahmetna Admin', email: 'admin@lahmetna.com', password: 'admin1234' },

    vendors: [
      { slug: 'bonkam', name: 'Bonkam Farm', location: 'Beheira', bio: 'Grass-fed cattle and raw pantry goods, raised on open pasture in the Nile Delta since 1998.' },
      { slug: 'elreef', name: 'Elreef Farm', location: 'Fayoum', bio: 'Free-range poultry and pasture-raised lamb and goat, hand-processed to order.' },
      { slug: 'elwady', name: 'Elwady Farm', location: 'Minya', bio: 'Dairy, eggs and same-week vegetables and fruit, grown without industrial shortcuts.' }
    ],

    products: [
      // Beef — Bonkam
      p('ribeye', 'bonkam', 'Beef', 'Dry-Aged Ribeye · 300g', '300g', 420, 4.9, 214, 'Dry-aged 28d', 40, 'Marbled ribeye dry-aged 28 days for a deep, nutty flavour. Grass-fed, hand-cut to order and vacuum-sealed cold.'),
      p('ground', 'bonkam', 'Beef', 'Grass-Fed Ground Beef · 500g', '500g', 130, 4.8, 180, '', 120, 'Coarse-ground from whole cuts the same morning — nothing but beef, ground fresh, never pre-frozen.'),
      p('shortrib', 'bonkam', 'Beef', 'Beef Short Ribs · 700g', '700g', 260, 4.7, 44, '', 30, 'Meaty bone-in short ribs, ideal for slow braising until they fall off the bone.'),
      p('tenderloin', 'bonkam', 'Beef', 'Beef Tenderloin · 400g', '400g', 480, 4.9, 60, '', 22, 'The most tender cut on the animal — trimmed clean, ready for the pan or grill.'),
      p('brisket', 'bonkam', 'Beef', 'Whole Brisket · 1.5kg', '1.5kg', 520, 4.7, 28, '', 15, 'Whole packer brisket with the fat cap on, built for low-and-slow smoking.'),
      // Lamb & Goat — Elreef
      p('lambchop', 'elreef', 'Lamb & Goat', 'Lamb Chops · 400g', '400g', 310, 4.9, 88, 'Bestseller', 50, 'Frenched lamb chops with a gorgeous fat cap, trimmed of gristle and cut thick.'),
      p('goatcut', 'elreef', 'Lamb & Goat', 'Goat Curry Cut · 1kg', '1kg', 240, 4.6, 31, '', 34, 'Bone-in goat cut into curry pieces — lean, flavourful and built for a long simmer.'),
      p('lambleg', 'elreef', 'Lamb & Goat', 'Whole Lamb Leg · ~2kg', '~2kg', 640, 4.8, 40, '', 18, 'Whole bone-in leg of pasture-raised lamb, perfect for roasting for a crowd.'),
      p('lambmince', 'elreef', 'Lamb & Goat', 'Lamb Mince · 500g', '500g', 180, 4.7, 52, '', 60, 'Freshly minced lamb with just the right fat ratio for kofta and koftas.'),
      // Poultry — Elreef
      p('chicken', 'elreef', 'Poultry', 'Whole Free-Range Chicken · ~1.4kg', '~1.4kg', 180, 4.8, 96, 'Free-range', 80, 'Genuinely free-range whole chicken — firmer, more flavourful meat and crisp skin.'),
      p('breast', 'elreef', 'Poultry', 'Chicken Breast Fillet · 500g', '500g', 120, 4.7, 150, '', 90, 'Skinless free-range breast fillets, trimmed and ready to cook.'),
      p('wings', 'elreef', 'Poultry', 'Chicken Wings · 700g', '700g', 95, 4.6, 40, '', 70, 'Plump free-range wings, split and ready for the grill or oven.'),
      p('duck', 'elreef', 'Poultry', 'Whole Duck · ~1.8kg', '~1.8kg', 300, 4.7, 24, '', 20, 'Whole farm duck with a thick fat layer for rich, slow roasting.'),
      // Eggs — Elwady
      p('eggs30', 'elwady', 'Eggs', 'Free-Range Eggs · 30', '30 eggs', 95, 4.9, 340, 'Laid this week', 200, 'Thirty free-range eggs with deep orange yolks, laid this week and never washed with chemicals.'),
      p('duckeggs', 'elwady', 'Eggs', 'Duck Eggs · 12', '12 eggs', 85, 4.7, 30, '', 60, 'Rich, large duck eggs — a baker’s secret for lofty, tender cakes.'),
      p('quaileggs', 'elwady', 'Eggs', 'Quail Eggs · 24', '24 eggs', 70, 4.6, 22, '', 45, 'Delicate speckled quail eggs, lovely soft-boiled or pickled.'),
      // Dairy — Elwady
      p('labneh', 'elwady', 'Dairy', 'Fresh Labneh · 500g', '500g', 70, 4.8, 60, '', 100, 'Thick, tangy strained labneh made from raw cow milk, cultured the traditional way.'),
      p('milk', 'elwady', 'Dairy', 'Raw Cow Milk · 1L', '1L', 45, 4.7, 52, '', 110, 'Un-homogenised raw cow milk, chilled straight from the morning milking.'),
      p('feta', 'elwady', 'Dairy', 'White Feta Cheese · 400g', '400g', 110, 4.8, 44, '', 70, 'Creamy brined white cheese with the perfect salty tang.'),
      p('ghee', 'elwady', 'Dairy', 'Cow Ghee (Samna) · 500g', '500g', 160, 4.9, 70, '', 55, 'Slow-clarified farm ghee with a nutty aroma — the backbone of Egyptian cooking.'),
      p('yogurt', 'elwady', 'Dairy', 'Farm Yogurt · 900g', '900g', 55, 4.7, 48, '', 90, 'Live-cultured whole-milk yogurt, thick and mild.'),
      p('butter', 'elwady', 'Dairy', 'Cultured Butter · 250g', '250g', 90, 4.8, 33, '', 65, 'Small-batch cultured butter churned from raw cream.'),
      // Vegetables — Elwady
      p('tomato', 'elwady', 'Vegetables', 'Heirloom Tomatoes · 1kg', '1kg', 60, 4.7, 52, 'Picked today', 140, 'Sun-ripened heirloom tomatoes picked the same morning — you can smell it.'),
      p('greens', 'elwady', 'Vegetables', 'Mixed Greens Box', 'box', 55, 4.6, 28, '', 80, 'A rotating box of the week’s leafy greens — molokhia, cress, rocket and more.'),
      p('potato', 'elwady', 'Vegetables', 'Baladi Potatoes · 2kg', '2kg', 40, 4.6, 36, '', 130, 'Earthy baladi potatoes, brushed not washed so they keep longer.'),
      p('onion', 'elwady', 'Vegetables', 'Red Onions · 1kg', '1kg', 25, 4.5, 30, '', 150, 'Sharp, firm red onions cured for sweetness.'),
      p('pepper', 'elwady', 'Vegetables', 'Bell Peppers · 750g', '750g', 45, 4.6, 24, '', 95, 'A mix of red, yellow and green peppers, crisp and glossy.'),
      p('cucumber', 'elwady', 'Vegetables', 'Baladi Cucumbers · 1kg', '1kg', 35, 4.6, 26, '', 120, 'Small, crunchy baladi cucumbers with thin skins.'),
      // Fruit — Elwady
      p('fruitbox', 'elwady', 'Fruit', 'Seasonal Fruit Box', 'box', 140, 4.8, 40, 'In season', 60, 'A generous box of whatever is at its peak this week, chosen by the farm.'),
      p('oranges', 'elwady', 'Fruit', 'Baladi Oranges · 2kg', '2kg', 70, 4.7, 44, '', 100, 'Juicy baladi oranges, thin-skinned and full of sun.'),
      p('mango', 'elwady', 'Fruit', 'Egyptian Mangoes · 1.5kg', '1.5kg', 180, 4.9, 88, 'In season', 40, 'Fragrant Egyptian mangoes — Owais and Zebda in season, tree-ripened.'),
      p('dates', 'elwady', 'Fruit', 'Fresh Dates · 1kg', '1kg', 120, 4.8, 36, '', 55, 'Soft fresh dates harvested at the rutab stage, honey-sweet.'),
      p('guava', 'elwady', 'Fruit', 'Guava · 1kg', '1kg', 65, 4.6, 30, '', 70, 'Perfumed pink guava, best eaten skin and all.'),
      // Honey & Pantry — Bonkam
      p('honey', 'bonkam', 'Honey', 'Raw Wildflower Honey · 500g', '500g', 190, 4.9, 120, '', 60, 'Unfiltered raw wildflower honey that crystallises as good honey should.'),
      p('blackhoney', 'bonkam', 'Honey', 'Sugarcane Black Honey · 800g', '800g', 90, 4.7, 40, '', 70, 'Thick sugarcane molasses (asal eswed) — iron-rich and deeply sweet.'),
      p('tahini', 'bonkam', 'Honey', 'Stone-Ground Tahini · 400g', '400g', 85, 4.8, 34, '', 80, 'Nutty stone-ground sesame tahini with nothing added.'),
      p('oliveoil', 'bonkam', 'Honey', 'Cold-Pressed Olive Oil · 750ml', '750ml', 260, 4.9, 66, '', 45, 'First cold-pressed extra-virgin olive oil, peppery and green.'),
      p('olives', 'bonkam', 'Honey', 'Cured Green Olives · 500g', '500g', 75, 4.6, 28, '', 90, 'Whole green olives cured in brine with lemon and chilli.'),
      // Livestock — weight-priced
      L('livesheep', 'elreef', 'Live Baladi Sheep', 220, 45, 4.9, 34, 'Eid favourite', 12, 'A healthy live baladi sheep, priced by live weight. Choose farm slaughter and butchering at checkout, or collection.'),
      L('livegoat', 'elreef', 'Live Baladi Goat', 210, 35, 4.8, 20, '', 10, 'Live baladi goat raised on open pasture, priced by live weight with optional slaughter and cutting.'),
      L('livecalf', 'bonkam', 'Live Calf (Baby Beef)', 180, 120, 4.8, 14, '', 6, 'A grass-fed live calf sold by live weight — the most economical way to stock a freezer.'),
      L('wholelamb', 'elreef', 'Whole Dressed Lamb', 300, 12, 4.9, 26, '', 16, 'A whole dressed lamb (skin off, cleaned), priced by dressed weight and cut to your spec.')
    ],

    // reviews link to a product id
    reviews: [
      { product: 'ribeye', name: 'Nour A.', rating: 5, date: '2026-08-30', title: 'Proper marbling, cooked like a steakhouse', body: 'Arrived cold and vacuum-sealed. Best ribeye I’ve cooked at home — and I know exactly which farm it came from.', helpful: 34 },
      { product: 'eggs30', name: 'Mariam K.', rating: 5, date: '2026-08-22', title: 'The eggs actually taste of something', body: 'Deep orange yolks, and they last for weeks. We’ve cancelled the supermarket order.', helpful: 21 },
      { product: 'tomato', name: 'Hassan D.', rating: 4, date: '2026-08-18', title: 'Tomatoes like my grandmother’s garden', body: 'Picked the same day, you can smell it. Docked a star only because they sold out before I could reorder.', helpful: 12 },
      { product: 'chicken', name: 'Omar S.', rating: 5, date: '2026-08-12', title: 'Chicken with real flavour', body: 'You forget what free-range actually tastes like. Skin crisped beautifully.', helpful: 9 },
      { product: 'lambchop', name: 'Layla M.', rating: 5, date: '2026-08-05', title: 'Lamb chops were exceptional', body: 'Trimmed perfectly, no gristle, gorgeous fat cap. Tender all the way through.', helpful: 15 },
      { product: 'shortrib', name: 'Youssef A.', rating: 3, date: '2026-07-28', title: 'Great meat, delivery ran late', body: 'The short ribs were superb and still cold on arrival, but the window slipped by two hours.', helpful: 6 },
      { product: 'honey', name: 'Salma H.', rating: 5, date: '2026-07-20', title: 'Honey is the real deal', body: 'Crystallises like raw honey should, and the flavour changes with the season.', helpful: 18 },
      { product: 'milk', name: 'Karim R.', rating: 4, date: '2026-07-11', title: 'Fresh milk, packaging could improve', body: 'Tastes genuinely fresh and creamy. One bottle leaked slightly — support refunded it instantly.', helpful: 4 },
      { product: 'labneh', name: 'Dina F.', rating: 5, date: '2026-07-02', title: 'Switched our whole kitchen over', body: 'Between the labneh, eggs and greens we barely shop anywhere else now.', helpful: 11 },
      { product: 'mango', name: 'Aya T.', rating: 5, date: '2026-08-27', title: 'The best mangoes of the summer', body: 'Tree-ripened and fragrant — nothing like the hard supermarket ones.', helpful: 14 },
      { product: 'livesheep', name: 'Tarek M.', rating: 5, date: '2026-06-10', title: 'Flawless Eid order', body: 'Chose farm slaughter and butchering, delivered cleaned and portioned exactly as asked. Will do every year.', helpful: 22 },
      { product: 'ghee', name: 'Hoda S.', rating: 5, date: '2026-08-02', title: 'Smells like my mother’s kitchen', body: 'Real samna, nutty and rich. A little goes a long way.', helpful: 8 }
    ],

    faqs: [
      { q: 'Where does the meat and produce come from?', a: 'Everything is sourced directly from vetted partner farms across the Egyptian countryside. Every order names the exact farm and cut date on its label, so you can always trace what you’re eating back to where it was raised or grown.' },
      { q: 'Is the meat halal?', a: 'Yes. All meat and poultry is halal and hand-processed to order by certified butchers. We never freeze twice, and our halal certification is available in the footer of every page.' },
      { q: 'How do live animals and slaughter work?', a: 'Live animals are priced by weight. At checkout you can choose farm slaughter and butchering (halal, hand-cut to your spec) with cold delivery, or collection of the live animal. It is especially popular around Eid — order early as stock is limited.' },
      { q: 'How does delivery and the cold-chain work?', a: 'Orders placed before 6pm are delivered next-day within Cairo and Giza. Everything travels sealed and chilled in insulated, temperature-tracked boxes. Delivery is free over EGP 800.' },
      { q: 'How should I store what I receive?', a: 'Fresh meat keeps 3–4 days refrigerated and up to 3 months frozen — portion before freezing. Eggs and dairy go straight to the fridge; leafy greens keep best loosely wrapped in the crisper drawer.' },
      { q: 'What if something arrives below standard?', a: 'Freshness is guaranteed. If anything arrives warm, damaged, or not up to standard, message us with a photo within 24 hours and we’ll refund or replace it — no need to return the item.' },
      { q: 'Which payment methods do you accept?', a: 'We accept Visa, Mastercard and Meeza cards through PayTabs, our secure payment provider, as well as cash on delivery. Card details are handled by PayTabs and never stored on our servers.' },
      { q: 'Can I sell my farm’s produce on Lahmetna?', a: 'Yes — use “Sell on Lahmetna” to apply. Our sourcing team reviews every application personally; once approved, you create your own vendor account and list your products from your dashboard.' }
    ]
  };
});
