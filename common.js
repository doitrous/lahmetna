/* Lahmetna — shared chrome, cart, auth state and helpers (LH namespace) */
window.LH = (function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (n) { return 'EGP ' + Number(n || 0).toLocaleString('en-US'); };
  var stars = function (r) { return '<span class="stars"><span style="width:' + (r / 5 * 100) + '%"></span></span>'; };

  function api(path, opts) {
    opts = opts || {}; opts.credentials = 'same-origin';
    if (opts.body && typeof opts.body !== 'string') { opts.headers = Object.assign({ 'content-type': 'application/json' }, opts.headers); opts.body = JSON.stringify(opts.body); }
    return fetch(path, opts).then(function (r) {
      return r.text().then(function (t) { var d; try { d = t ? JSON.parse(t) : {}; } catch (e) { d = {}; } if (!r.ok) { var err = new Error(d.error || ('HTTP ' + r.status)); err.status = r.status; throw err; } return d; });
    });
  }
  function POST(p, b) { return api(p, { method: 'POST', body: b || {} }); }

  /* ---------- i18n (Arabic / RTL) ---------- */
  var lang = 'en';
  try { if (localStorage.getItem('lah_lang') === 'ar') lang = 'ar'; } catch (e) {}
  if (lang === 'ar') { try { document.documentElement.lang = 'ar'; document.documentElement.dir = 'rtl'; } catch (e) {} }

  // English text -> Arabic. Drives both t() and the DOM text-node pass.
  var AR = {
    // top bar + chrome
    'Free cold-chain delivery over EGP 800 · Cairo & Giza': 'توصيل مبرّد مجاني للطلبات فوق ٨٠٠ ج.م · القاهرة والجيزة',
    'Track order': 'تتبّع الطلب', 'Sell on Lahmetna': 'بِع على لحمتنا', 'العربية': 'English',
    'Log in': 'تسجيل الدخول', 'Cart ·': 'السلة ·', 'Menu': 'القائمة',
    'Search ribeye, free-range eggs, heirloom tomatoes…': 'ابحث عن ريب آي، بيض بلدي، طماطم…',
    // nav
    'Shop all': 'كل المنتجات', 'Beef': 'لحم بقري', 'Lamb & Goat': 'ضأن وماعز', 'Poultry': 'دواجن',
    'Vegetables': 'خضروات', 'Fruit': 'فاكهة', 'Livestock': 'مواشٍ حية', 'Reviews': 'التقييمات', 'FAQ': 'الأسئلة الشائعة',
    "This week's harvest": 'حصاد هذا الأسبوع', 'Eggs': 'بيض', 'Dairy': 'ألبان', 'Honey': 'عسل', 'All': 'الكل',
    // cart drawer
    'Your cart': 'سلة التسوق', 'Your cart is empty.': 'سلة التسوق فارغة.',
    'Fresh from the farm is a click away.': 'الطازج من المزرعة على بُعد نقرة.',
    'Subtotal': 'الإجمالي الفرعي', 'Checkout': 'إتمام الشراء',
    'Delivery calculated at checkout · free over EGP 800': 'تُحتسب رسوم التوصيل عند الدفع · مجاني فوق ٨٠٠ ج.م',
    // account menu
    'My account': 'حسابي', 'Order history': 'سجل الطلبات', 'Addresses': 'العناوين', 'Support': 'الدعم',
    'Log out': 'تسجيل الخروج', 'Vendor dashboard': 'لوحة البائع', 'Orders': 'الطلبات', 'Earnings': 'الأرباح',
    'Admin console': 'لوحة الإدارة', 'Support queue': 'قائمة الدعم', 'Payouts': 'المدفوعات', 'Settings': 'الإعدادات',
    // footer
    'The marketplace for naturally raised meat and fresh farm produce, direct from named farms across Egypt.': 'سوق اللحوم المُربّاة طبيعيًا والمنتجات الطازجة، مباشرة من مزارع معروفة في كل أنحاء مصر.',
    'Cash on delivery': 'الدفع عند الاستلام', 'Shop': 'تسوّق', 'Company': 'الشركة', 'Help': 'المساعدة',
    'Poultry & Eggs': 'دواجن وبيض', 'Vegetables & Fruit': 'خضروات وفاكهة', 'How it works': 'كيف نعمل',
    'Sustainability': 'الاستدامة', 'Careers': 'الوظائف', 'FAQs': 'الأسئلة الشائعة',
    // popular searches (footer) — real category pages, per V2-PHASE-8's hierarchy requirement
    'Popular searches': 'الأكثر بحثًا', 'Fresh Beef': 'لحم بقري طازج', 'Lamb & Goat Meat': 'لحم ضأن وماعز',
    'Free-Range Poultry': 'دواجن تربية حرة', 'Farm Fresh Eggs': 'بيض بلدي طازج', 'Fresh Dairy': 'ألبان طازجة',
    'Fresh Vegetables': 'خضروات طازجة', 'Seasonal Fruit': 'فاكهة موسمية', 'Live Livestock': 'مواشٍ حية',
    'Editorial guidelines': 'معايير التحرير',
    'Delivery & cold-chain': 'التوصيل والتبريد', 'Returns & refunds': 'الإرجاع والاسترداد', 'Contact us': 'اتصل بنا',
    '© 2026 Lahmetna. Raised right, priced fair.': '© ٢٠٢٦ لحمتنا. تربية سليمة وسعر عادل.',
    'Privacy': 'الخصوصية', 'Terms': 'الشروط', 'Cookies': 'ملفات تعريف الارتباط', 'Halal certification': 'شهادة الحلال',
    // hero
    'Farm-direct · raised right, priced fair': 'من المزرعة مباشرة · تربية سليمة وسعر عادل',
    'real meat.': 'لحم أصلي.', 'no middlemen.': 'بدون وسطاء.', 'delivered.': 'يصل لبابك.',
    'The marketplace for naturally raised meat, live animals and fresh farm produce — sourced from named farms, cut to order, and carried cold to your door.': 'سوق اللحوم المُربّاة طبيعيًا والحيوانات الحية والمنتجات الطازجة — من مزارع معروفة، تُقطّع حسب الطلب، وتصل مبرّدة إلى باب بيتك.',
    'Shop the farm': 'تسوّق من المزرعة',
    '40+ partner farms · 12k kitchens served · 4.9★ average rating': 'أكثر من ٤٠ مزرعة شريكة · خدمنا ١٢ ألف مطبخ · تقييم ٤.٩★',
    'FRESH THIS': 'طازج هذا', 'WEEK': 'الأسبوع', 'farm harvest': 'حصاد المزرعة',
    // trust strip
    'Pasture-raised': 'تربية بالمرعى', 'Grass-fed, no routine antibiotics': 'تغذية طبيعية، بلا مضادات حيوية روتينية',
    'Halal & hand-cut': 'حلال وتقطيع يدوي', 'Processed to order, never frozen twice': 'يُجهّز حسب الطلب، بلا تجميد مكرّر',
    'Next-day cold-chain': 'توصيل مبرّد في اليوم التالي', 'Sealed, chilled, tracked end-to-end': 'مغلّف ومبرّد ومتتبَّع بالكامل',
    'Traceable sourcing': 'مصدر موثّق', 'Every order names its farm': 'كل طلب يذكر مزرعته',
    // categories section
    'Shop by farm line': 'تسوّق حسب فئة المزرعة', 'Everything a fresh farm makes': 'كل ما تنتجه مزرعة طازجة',
    'Browse all products': 'تصفّح كل المنتجات', 'The market': 'السوق', 'Fresh this week': 'طازج هذا الأسبوع',
    'Dry-aged & fresh': 'مُعتّق وطازج', 'Free-range': 'تربية حرة', 'Laid this week': 'بيض هذا الأسبوع',
    'Milk, labneh, cheese': 'حليب، لبنة، جبن', 'Picked daily': 'يُقطف يوميًا', 'In season': 'في الموسم',
    'Raw honey, pantry': 'عسل خام ومؤن', 'Live & whole animals': 'حيوانات حية وكاملة',
    // product cards
    'Add': 'أضف', 'Sold out': 'نفد', 'New': 'جديد', 'Show more': 'عرض المزيد',
    // our farms
    'Our farms': 'مزارعنا', 'Every order traces back': 'كل طلب يعود', 'to a farm you can name': 'إلى مزرعة تعرف اسمها',
    'Bonkam, Elreef and Elwady raise their animals on open pasture and grow produce without the industrial shortcuts. You see the farm, the cut date, and the hands behind it — on every label.': 'مزارع بونكام والريف والوادي تربّي حيواناتها في مراعٍ مفتوحة وتزرع دون اختصارات صناعية. ترى المزرعة وتاريخ التقطيع والأيادي التي وراءه — على كل ملصق.',
    'Open pasture': 'مرعى مفتوح', 'No growth hormones': 'بلا هرمونات نمو', 'Same-week harvest': 'حصاد نفس الأسبوع',
    'Become a vendor': 'كن بائعًا',
    // reviews + faq + newsletter
    'Loved by 12,000+ kitchens': 'يحبّه أكثر من ١٢٬٠٠٠ مطبخ', '4.9 · 3,180+ verified orders': '٤.٩ · أكثر من ٣٬١٨٠ طلب موثّق',
    'Help centre': 'مركز المساعدة', 'Frequently asked questions': 'الأسئلة الشائعة',
    'Everything about sourcing, live animals, delivery, storage and returns. Still stuck? Our team answers within the hour, 9am–9pm.': 'كل ما يخص المصدر والحيوانات الحية والتوصيل والتخزين والإرجاع. ما زلت محتارًا؟ فريقنا يرد خلال ساعة، من ٩ صباحًا حتى ٩ مساءً.',
    'Newsletter': 'النشرة البريدية', 'Fresh drops, every Thursday': 'وصل جديد كل خميس',
    "What's in season, what's just been cut, and members-only pricing. No spam — one email a week.": 'ما هو في الموسم، وما تم تقطيعه للتو، وأسعار خاصة للأعضاء. بلا إزعاج — رسالة واحدة أسبوعيًا.',
    'Subscribe': 'اشترك', 'you@email.com': 'بريدك الإلكتروني',
    // common labels (auth / checkout / product)
    'Home': 'الرئيسية', 'In stock': 'متوفر', 'Add to cart': 'أضف إلى السلة', 'Continue': 'متابعة',
    'Create account': 'إنشاء حساب', 'Please log in to check out': 'سجّل الدخول لإتمام الشراء',
    // contact page
    'We’re here to help': 'نحن هنا لمساعدتك', 'Get in touch': 'تواصل معنا', 'Message': 'الرسالة',
    'Questions about an order, our farms, delivery or anything else? Send us a message and our team will get back to you — we answer within the hour, 9am–9pm.': 'أسئلة عن طلب أو مزارعنا أو التوصيل أو أي شيء آخر؟ أرسل لنا رسالة وسيرد عليك فريقنا — نرد خلال ساعة، من ٩ صباحًا حتى ٩ مساءً.',
    'What’s this about?': 'ما موضوع رسالتك؟', 'How can we help?': 'كيف يمكننا مساعدتك؟', 'Send message': 'إرسال الرسالة',
    'Other ways to reach us': 'طرق أخرى للتواصل', 'Email us': 'راسلنا بالبريد',
    'Track or manage an order': 'تتبّع أو إدارة طلب', 'Your account →': 'حسابك →',
    'Apply as a farm or producer →': 'قدّم كمزرعة أو منتِج →',
    'We deliver across Cairo & Giza · our team answers within the hour, 9am–9pm.': 'نوصّل في القاهرة والجيزة · فريقنا يرد خلال ساعة، من ٩ صباحًا حتى ٩ مساءً.'
  };

  // product id -> Arabic display name
  var PRODAR = {
    ribeye: 'ريب آي مُعتّق · ٣٠٠ج', ground: 'لحم بقري مفروم · ٥٠٠ج', shortrib: 'ضلوع بقري قصيرة · ٧٠٠ج',
    tenderloin: 'فيليه بقري · ٤٠٠ج', brisket: 'صدر بقري كامل · ١.٥كجم', lambchop: 'ريش ضأن · ٤٠٠ج',
    goatcut: 'قطع ماعز للطبخ · ١كجم', lambleg: 'فخذ ضأن كامل · ~٢كجم', lambmince: 'لحم ضأن مفروم · ٥٠٠ج',
    chicken: 'دجاجة بلدي كاملة · ~١.٤كجم', breast: 'صدور دجاج · ٥٠٠ج', wings: 'أجنحة دجاج · ٧٠٠ج',
    duck: 'بطة كاملة · ~١.٨كجم', eggs30: 'بيض بلدي · ٣٠ بيضة', duckeggs: 'بيض بط · ١٢ بيضة',
    quaileggs: 'بيض سمّان · ٢٤ بيضة', labneh: 'لبنة طازجة · ٥٠٠ج', milk: 'حليب بقري خام · ١ لتر',
    feta: 'جبن أبيض · ٤٠٠ج', ghee: 'سمن بلدي · ٥٠٠ج', yogurt: 'زبادي بلدي · ٩٠٠ج', butter: 'زبدة مخمّرة · ٢٥٠ج',
    tomato: 'طماطم بلدي · ١كجم', greens: 'صندوق خضار ورقية', potato: 'بطاطس بلدي · ٢كجم', onion: 'بصل أحمر · ١كجم',
    pepper: 'فلفل ألوان · ٧٥٠ج', cucumber: 'خيار بلدي · ١كجم', fruitbox: 'صندوق فاكهة موسمية',
    oranges: 'برتقال بلدي · ٢كجم', mango: 'مانجو مصري · ١.٥كجم', dates: 'بلح طازج · ١كجم', guava: 'جوافة · ١كجم',
    honey: 'عسل نحل خام · ٥٠٠ج', blackhoney: 'عسل أسود · ٨٠٠ج', tahini: 'طحينة · ٤٠٠ج',
    oliveoil: 'زيت زيتون بكر · ٧٥٠مل', olives: 'زيتون أخضر · ٥٠٠ج', livesheep: 'خروف بلدي حي',
    livegoat: 'ماعز بلدي حي', livecalf: 'عجل حي (بتلو)', wholelamb: 'خروف كامل مذبوح',
    'nh-beef': 'قطعة لحم بقري (عينة) · ٥٠٠ج', 'nh-lamb': 'قطعة ضأن (عينة) · ٥٠٠ج',
    'nh-poultry': 'منتج دواجن (عينة) · ٥٠٠ج', 'nh-eggs': 'بيض بلدي (عينة) · ١٢ بيضة',
    'nh-dairy': 'منتج ألبان (عينة) · ٥٠٠ج', 'nh-veg': 'صندوق خضار (عينة)', 'nh-fruit': 'صندوق فاكهة (عينة)',
    'nh-honey': 'عسل خام (عينة) · ٥٠٠ج', 'nh-livestock': 'حيوان حي (عينة)'
  };

  // English FAQ question -> Arabic {q,a}
  var FAQAR = {
    'Where does the meat and produce come from?': { q: 'من أين تأتي اللحوم والمنتجات؟', a: 'كل شيء يُورَّد مباشرة من مزارع شريكة موثّقة في الريف المصري. كل طلب يذكر المزرعة وتاريخ التقطيع على ملصقه، حتى تتمكن دائمًا من تتبّع ما تأكله إلى حيث تمت تربيته أو زراعته.' },
    'Is the meat halal?': { q: 'هل اللحوم حلال؟', a: 'نعم. كل اللحوم والدواجن حلال وتُجهّز حسب الطلب على يد جزّارين معتمدين. لا نجمّد مرتين أبدًا، وشهادة الحلال متاحة في تذييل كل صفحة.' },
    'How do live animals and slaughter work?': { q: 'كيف تعمل الحيوانات الحية والذبح؟', a: 'تُسعّر الحيوانات الحية بالوزن. عند الدفع يمكنك اختيار الذبح والتقطيع في المزرعة (حلال، تقطيع يدوي حسب طلبك) مع توصيل مبرّد، أو استلام الحيوان حيًّا. وهو شائع بشكل خاص في العيد — اطلب مبكرًا فالكمية محدودة.' },
    'How does delivery and the cold-chain work?': { q: 'كيف يعمل التوصيل وسلسلة التبريد؟', a: 'الطلبات قبل السادسة مساءً تُسلَّم في اليوم التالي داخل القاهرة والجيزة. كل شيء يُنقل مغلّفًا ومبرّدًا في صناديق معزولة ومتتبَّعة الحرارة. التوصيل مجاني فوق ٨٠٠ ج.م.' },
    'How should I store what I receive?': { q: 'كيف أخزّن ما أستلمه؟', a: 'اللحوم الطازجة تدوم ٣–٤ أيام في الثلاجة وحتى ٣ أشهر في الفريزر — قسّمها قبل التجميد. البيض والألبان مباشرة إلى الثلاجة؛ والخضار الورقية تدوم أفضل ملفوفة بخفة في درج الحفظ.' },
    'What if something arrives below standard?': { q: 'ماذا لو وصل شيء دون المستوى؟', a: 'الطزاجة مضمونة. إذا وصل أي شيء دافئًا أو تالفًا أو دون المستوى، راسلنا بصورة خلال ٢٤ ساعة وسنسترد المبلغ أو نستبدله — دون حاجة لإرجاع المنتج.' },
    'Which payment methods do you accept?': { q: 'ما وسائل الدفع المقبولة؟', a: 'نقبل بطاقات فيزا وماستركارد وميزة عبر PayTabs، مزوّد الدفع الآمن لدينا، إضافة إلى الدفع عند الاستلام. تُدار بيانات البطاقة عبر PayTabs ولا تُخزَّن على خوادمنا أبدًا.' },
    'Can I sell my farm’s produce on Lahmetna?': { q: 'هل يمكنني بيع منتجات مزرعتي على لحمتنا؟', a: 'نعم — استخدم «بِع على لحمتنا» للتقديم. يراجع فريق التوريد كل طلب شخصيًا؛ وبعد الموافقة تنشئ حساب بائع خاصًا بك وتُدرج منتجاتك من لوحتك.' }
  };

  // dashboards (customer / vendor / admin) + product page + status words
  Object.assign(AR, {
    // dashboard tab labels + headers
    'Overview': 'نظرة عامة', 'Products': 'المنتجات', 'Analytics': 'التحليلات', 'Store profile': 'ملف المتجر',
    'Security': 'الأمان', 'Payment methods': 'طرق الدفع', 'Login & security': 'تسجيل الدخول والأمان',
    'Catalog': 'الكتالوج', 'Vendors': 'البائعون', 'Customers': 'العملاء', 'Applications': 'طلبات الانضمام',
    'Subscriptions': 'الاشتراكات', 'Marketing': 'التسويق', 'Legal pages': 'الصفحات القانونية',
    'Lahmetna operations': 'عمليات لحمتنا', 'Your farm': 'مزرعتك',
    // common table headers / labels
    'Order': 'الطلب', 'Date': 'التاريخ', 'Status': 'الحالة', 'Total': 'الإجمالي', 'Details': 'التفاصيل',
    'Category': 'الفئة', 'Price': 'السعر', 'Stock': 'المخزون', 'Product': 'المنتج', 'Vendor': 'البائع',
    'Customer': 'العميل', 'Method': 'طريقة الدفع', 'Manage': 'إدارة', 'Edit': 'تعديل', 'Delete': 'حذف',
    'Name': 'الاسم', 'Email': 'البريد الإلكتروني', 'Phone': 'الهاتف', 'City': 'المدينة', 'Label': 'التسمية',
    'Subject': 'الموضوع', 'Updated': 'آخر تحديث', 'Open': 'فتح', 'Send': 'إرسال', 'Amount': 'المبلغ',
    'Created': 'أُنشئت', 'Paid': 'مدفوع', 'Plan': 'الخطة', 'Commission': 'العمولة', 'Revenue': 'الإيراد',
    'Member': 'عضو', 'Spend': 'الإنفاق', 'Code': 'الكود', 'Type': 'النوع', 'Value': 'القيمة',
    'Used': 'مستخدم', 'From': 'من', 'Priority': 'الأولوية', 'Owed': 'المستحق', 'Item': 'الصنف',
    'Qty': 'الكمية', 'Line': 'الإجمالي', 'Net': 'الصافي', 'Gross': 'الإجمالي', 'Settled': 'تمت التسوية',
    'Units': 'الوحدات', 'Discount': 'الخصم', 'Delivery': 'التوصيل', 'Free': 'مجاني', 'Refunded': 'مسترد',
    'Tracking': 'التتبّع', 'Timeline': 'المسار الزمني', 'Default': 'افتراضي', 'Remove': 'إزالة',
    // status words (st())
    'active': 'نشط', 'pending': 'قيد الانتظار', 'processing': 'قيد المعالجة', 'confirmed': 'مؤكد',
    'packed': 'تم التغليف', 'shipped': 'تم الشحن', 'delivered': 'تم التوصيل', 'cancelled': 'ملغى',
    'refunded': 'مسترد', 'paid': 'مدفوع', 'closed': 'مغلق', 'resolved': 'تم الحل', 'open': 'مفتوح',
    'high': 'عاجل', 'normal': 'عادي', 'expired': 'منتهٍ', 'cancelled-sub': 'قيد الإلغاء',
    // customer account
    'Orders placed': 'الطلبات المنفذة', 'Lifetime spend': 'إجمالي الإنفاق', 'Latest order': 'أحدث طلب',
    'View orders': 'عرض الطلبات', 'Join Lahmetna One': 'انضم إلى Lahmetna One', 'See benefits': 'عرض المزايا',
    'Free delivery, 7% member pricing, priority support.': 'توصيل مجاني، خصم ٧٪ للأعضاء، ودعم ذو أولوية.',
    'No orders yet.': 'لا توجد طلبات بعد.', 'Start shopping': 'ابدأ التسوّق', 'Buy again': 'اشترِ مجددًا',
    'Get help with this order': 'مساعدة بشأن هذا الطلب', '+ Add address': '+ إضافة عنوان',
    'Make default': 'اجعله افتراضيًا', 'No saved addresses yet.': 'لا توجد عناوين محفوظة بعد.',
    'Edit address': 'تعديل العنوان', 'Add address': 'إضافة عنوان', 'Recipient': 'المستلم',
    'Street address': 'عنوان الشارع', 'Apartment / floor (optional)': 'الشقة / الطابق (اختياري)',
    'Governorate': 'المحافظة', 'Save address': 'حفظ العنوان', '+ Add card': '+ إضافة بطاقة',
    'We never store full card numbers — only a secure token, the card brand and last 4 digits.': 'لا نخزّن أرقام البطاقات كاملة أبدًا — فقط رمزًا آمنًا ونوع البطاقة وآخر ٤ أرقام.',
    'No saved cards. You can also pay cash on delivery at checkout.': 'لا توجد بطاقات محفوظة. يمكنك أيضًا الدفع عند الاستلام.',
    'Add a card': 'إضافة بطاقة',
    'Enter only your card brand and the last 4 digits — never the full number. A secure token stands in for the card.': 'أدخل نوع البطاقة وآخر ٤ أرقام فقط — لا الرقم كاملًا. يحل رمز آمن محل البطاقة.',
    'Card brand': 'نوع البطاقة', 'Last 4 digits': 'آخر ٤ أرقام', 'Expiry': 'تاريخ الانتهاء', 'Save card': 'حفظ البطاقة',
    'Free delivery': 'توصيل مجاني', 'Free cold-chain delivery on member orders over EGP 450.': 'توصيل مبرّد مجاني لطلبات الأعضاء فوق ٤٥٠ ج.م.',
    'Member pricing': 'أسعار الأعضاء', '7% off your subtotal on every order, automatically.': 'خصم ٧٪ على إجمالي كل طلب تلقائيًا.',
    'Early access': 'وصول مبكر', 'Shop the weekly harvest drops before everyone else.': 'تسوّق وصول الحصاد الأسبوعي قبل الجميع.',
    'Priority support': 'دعم ذو أولوية', 'Your tickets jump the queue and are flagged high-priority.': 'تُقدَّم تذاكرك في الصف وتُوسم بأولوية عالية.',
    'Renews': 'يتجدد في', 'Cancel membership': 'إلغاء العضوية', 'Resume membership': 'استئناف العضوية',
    'Billed monthly via PayTabs. Cancel anytime.': 'يُدفع شهريًا عبر PayTabs. ألغِ في أي وقت.',
    'Billing history': 'سجل الفواتير', '+ New request': '+ طلب جديد', 'No support requests yet.': 'لا توجد طلبات دعم بعد.',
    'This request is closed.': 'هذا الطلب مغلق.', 'Write a reply…': 'اكتب ردًا…', 'Close request': 'إغلاق الطلب',
    'New support request': 'طلب دعم جديد', 'How can we help?': 'كيف يمكننا مساعدتك؟', 'Submit request': 'إرسال الطلب',
    'Order (optional)': 'الطلب (اختياري)', 'Product quality': 'جودة المنتج', 'Billing': 'الفوترة', 'Other': 'أخرى',
    'Profile': 'الملف الشخصي', 'Save profile': 'حفظ الملف', 'Change password': 'تغيير كلمة المرور',
    'Current password': 'كلمة المرور الحالية', 'New password': 'كلمة المرور الجديدة', 'Update password': 'تحديث كلمة المرور',
    // vendor
    'Featured store': 'متجر مميز', 'Gross sales': 'إجمالي المبيعات', 'Net earnings': 'صافي الأرباح',
    'Pending payout': 'دفعة معلّقة', 'Manage products': 'إدارة المنتجات',
    'Add products, fulfill orders, and track your earnings. Products appear in the shop instantly.': 'أضف المنتجات ونفّذ الطلبات وتابع أرباحك. تظهر المنتجات في المتجر فورًا.',
    'Upgrade to Lahmetna Awal': 'الترقية إلى Lahmetna Awal',
    'Lower commission (8%), featured placement, weekly payouts, advanced analytics.': 'عمولة أقل (٨٪)، ظهور مميز، مدفوعات أسبوعية، تحليلات متقدمة.',
    'See Awal': 'عرض Awal', '+ Add product': '+ إضافة منتج', 'No products yet.': 'لا توجد منتجات بعد.',
    '+ Add your first product': '+ أضف أول منتج لك', 'Your items': 'منتجاتك', 'Your total': 'إجماليك',
    'Fulfillment': 'التنفيذ', 'No orders yet — they’ll appear here as customers buy your products.': 'لا توجد طلبات بعد — ستظهر هنا عندما يشتري العملاء منتجاتك.',
    'Mark confirmed': 'وضع علامة: مؤكد', 'Mark packed': 'وضع علامة: تم التغليف', 'Mark shipped': 'وضع علامة: تم الشحن', 'Mark delivered': 'وضع علامة: تم التوصيل',
    'No earnings yet.': 'لا توجد أرباح بعد.', 'Pending balance': 'الرصيد المعلّق', 'Payout': 'الدفعة',
    'Lahmetna settles payouts to your registered account on the cadence above. Admin marks each payout as paid.': 'تسوّي لحمتنا المدفوعات إلى حسابك المسجّل حسب الجدول أعلاه. تعلّم الإدارة كل دفعة كمدفوعة.',
    'No payouts issued yet.': 'لم تُصدر أي مدفوعات بعد.', 'Revenue · recent days': 'الإيرادات · الأيام الأخيرة',
    'No sales data yet.': 'لا توجد بيانات مبيعات بعد.', 'Top products': 'أفضل المنتجات',
    'No product sales yet.': 'لا توجد مبيعات منتجات بعد.', 'Lower commission': 'عمولة أقل',
    'Pay 8% instead of 12% on every sale — it usually pays for itself.': 'ادفع ٨٪ بدل ١٢٪ على كل بيع — غالبًا ما يغطي تكلفته.',
    'Featured placement': 'ظهور مميز', 'Your store and products get boosted visibility across Lahmetna.': 'يحصل متجرك ومنتجاتك على ظهور معزّز عبر لحمتنا.',
    'Weekly payouts': 'مدفوعات أسبوعية', 'Get settled weekly instead of the standard cadence.': 'احصل على تسوية أسبوعية بدل الجدول القياسي.',
    'Advanced analytics': 'تحليلات متقدمة', 'Daily revenue trends and top-product breakdowns.': 'اتجاهات الإيراد اليومية وتفصيل أفضل المنتجات.',
    'Cancel Awal': 'إلغاء Awal', 'Resume Awal': 'استئناف Awal', 'Store name': 'اسم المتجر',
    'Location': 'الموقع', 'About your farm': 'عن مزرعتك', 'Account': 'الحساب',
    // vendor product modal (static in vendor.html)
    'Product name': 'اسم المنتج', 'Packaged product': 'منتج مغلّف', 'Live / whole animal': 'حيوان حي / كامل',
    'Price (EGP)': 'السعر (ج.م)', 'Unit': 'الوحدة', 'Price per kg (EGP)': 'السعر لكل كجم (ج.م)',
    'Est. weight (kg)': 'الوزن التقديري (كجم)', 'Badge (optional)': 'شارة (اختياري)', 'Description': 'الوصف',
    'Active (visible in the shop)': 'نشط (ظاهر في المتجر)', 'Save product': 'حفظ المنتج', 'Add product': 'إضافة منتج',
    // admin
    'GMV': 'إجمالي المبيعات', 'Commission earned': 'العمولة المحصّلة', 'Paid orders': 'الطلبات المدفوعة',
    'Active vendors': 'البائعون النشطون', 'One members': 'أعضاء One', 'Awal vendors': 'بائعو Awal',
    'Open tickets': 'التذاكر المفتوحة', 'Pending payouts': 'مدفوعات معلّقة', 'Review': 'مراجعة',
    'Open queue': 'فتح القائمة', 'Settle': 'تسوية', 'COD': 'الدفع عند الاستلام', 'Card': 'بطاقة',
    'Refund': 'استرداد', 'Cancel order': 'إلغاء الطلب', 'Hide': 'إخفاء', 'Show': 'إظهار',
    'Commission rate (%)': 'نسبة العمولة (٪)', 'No': 'لا', 'Yes': 'نعم', 'Suspend this vendor': 'أوقف هذا البائع',
    'Save changes': 'حفظ التغييرات', 'Suspend': 'إيقاف', 'Unsuspend': 'إلغاء الإيقاف',
    'Vendor applications': 'طلبات انضمام البائعين', 'Approve': 'موافقة', 'Reject': 'رفض',
    'Vendor created': 'تم إنشاء البائع', 'Declined': 'مرفوض', 'Reply to customer…': 'ردّ على العميل…',
    'Send reply': 'إرسال الرد', 'Awaiting customer': 'بانتظار العميل', 'Resolved': 'تم الحل',
    'Closed': 'مغلق', 'Set normal': 'تعيين عادي', 'Set high': 'تعيين عاجل', 'Pending balances': 'الأرصدة المعلّقة',
    'Create payout': 'إنشاء دفعة', 'No pending balances.': 'لا أرصدة معلّقة.', 'Payout history': 'سجل المدفوعات',
    'Mark paid': 'تعليم كمدفوع', 'No payouts yet.': 'لا مدفوعات بعد.', 'Subscriber': 'المشترك',
    'Started': 'بدأ في', 'No subscriptions yet.': 'لا اشتراكات بعد.', 'Coupons': 'الكوبونات',
    '+ New coupon': '+ كوبون جديد', 'Min order': 'أقل طلب', 'Disable': 'تعطيل', 'Enable': 'تفعيل',
    'No coupons yet.': 'لا كوبونات بعد.', 'New coupon': 'كوبون جديد', 'Percent off': 'نسبة خصم',
    'Flat amount': 'مبلغ ثابت', 'Min order (EGP)': 'أقل طلب (ج.م)', 'Usage limit (optional)': 'حد الاستخدام (اختياري)',
    'Create coupon': 'إنشاء الكوبون', 'Legal & policy pages': 'الصفحات القانونية والسياسات',
    'Edit the content of each public policy page. Saved changes go live immediately on the site.': 'عدّل محتوى كل صفحة سياسة عامة. تُنشر التغييرات المحفوظة فورًا على الموقع.',
    'Page': 'الصفحة', 'Public URL': 'الرابط العام', 'Title': 'العنوان', 'Body (HTML)': 'المحتوى (HTML)',
    'Save page': 'حفظ الصفحة', 'Preview': 'معاينة', 'Platform settings': 'إعدادات المنصة',
    'Standard commission (0–1)': 'العمولة القياسية (٠–١)', 'Awal commission (0–1)': 'عمولة Awal (٠–١)',
    'Lahmetna One price (EGP/mo)': 'سعر Lahmetna One (ج.م/شهر)', 'Lahmetna Awal price (EGP/mo)': 'سعر Lahmetna Awal (ج.م/شهر)',
    'One member discount (0–1)': 'خصم عضو One (٠–١)', 'Delivery fee (EGP)': 'رسوم التوصيل (ج.م)',
    'Free delivery over (EGP)': 'توصيل مجاني فوق (ج.م)', 'Member free delivery over (EGP)': 'توصيل مجاني للأعضاء فوق (ج.م)',
    'Slaughter fee (EGP)': 'رسوم الذبح (ج.م)', 'Save settings': 'حفظ الإعدادات',
    // product page
    'No reviews yet': 'لا توجد تقييمات بعد', 'Add to cart ·': 'أضف إلى السلة ·', 'Farm': 'المزرعة',
    'Freshness': 'الطزاجة', 'Cut / picked to order': 'يُقطع/يُقطف حسب الطلب', 'Customer reviews': 'تقييمات العملاء',
    'Write a review': 'اكتب تقييمًا', 'Your rating': 'تقييمك', 'Headline': 'العنوان', 'Sum it up': 'لخّصه',
    'Your review': 'تقييمك', 'Quality, freshness, delivery…': 'الجودة، الطزاجة، التوصيل…', 'Submit review': 'إرسال التقييم',
    'By posting, you agree to our review guidelines.': 'بالنشر، أنت توافق على إرشادات التقييم لدينا.',
    'More from this farm line': 'المزيد من هذه المزرعة', 'Sort': 'الترتيب', 'Most recent': 'الأحدث',
    'Most helpful': 'الأكثر إفادة', 'Highest': 'الأعلى', 'Lowest': 'الأدنى', 'Loading…': 'جارٍ التحميل…',
    'Back to shop': 'العودة للمتجر', 'Product not found.': 'المنتج غير موجود.', 'Product not specified.': 'لم يُحدَّد المنتج.',
    // toasts
    'Address saved': 'تم حفظ العنوان', 'Card saved': 'تم حفظ البطاقة', 'Welcome to Lahmetna One!': 'مرحبًا بك في Lahmetna One!',
    'Membership cancelled': 'تم إلغاء العضوية', 'Request closed': 'تم إغلاق الطلب', 'Request submitted': 'تم إرسال الطلب',
    'Profile updated': 'تم تحديث الملف', 'Password updated': 'تم تحديث كلمة المرور', 'Profile saved': 'تم حفظ الملف',
    'Product deleted': 'تم حذف المنتج', 'Product updated': 'تم تحديث المنتج', 'Product added': 'تمت إضافة المنتج',
    'Welcome to Lahmetna Awal!': 'مرحبًا بك في Lahmetna Awal!', 'Awal cancelled': 'تم إلغاء Awal',
    'Vendor updated': 'تم تحديث البائع', 'Order refunded': 'تم استرداد الطلب', 'Order cancelled': 'تم إلغاء الطلب',
    'Deleted': 'تم الحذف', 'Approved': 'تمت الموافقة', 'Rejected': 'تم الرفض', 'Payout created': 'تم إنشاء الدفعة',
    'Marked paid': 'تم التعليم كمدفوع', 'Coupon created': 'تم إنشاء الكوبون', 'Settings saved': 'تم حفظ الإعدادات',
    'Page saved': 'تم حفظ الصفحة', 'Status updated': 'تم تحديث الحالة', 'Suspended': 'تم الإيقاف', 'Unsuspended': 'تم إلغاء الإيقاف'
  });

  function t(en) { return (lang === 'ar' && AR[en]) ? AR[en] : en; }
  function setLang(l) { try { localStorage.setItem('lah_lang', l); } catch (e) {} location.reload(); }
  function tFaq(list) { return (lang !== 'ar') ? list : (list || []).map(function (f) { var a = FAQAR[f.q]; return a ? { q: a.q, a: a.a } : f; }); }
  function injectArFont() {
    if (document.getElementById('lh-ar-font')) return;
    var l = document.createElement('link'); l.id = 'lh-ar-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap';
    document.head.appendChild(l);
  }
  // exact match, else a "Word (12)" count heading whose base word is known
  function arFor(s) {
    if (AR[s]) return AR[s];
    var m = s.match(/^(.+?) \((\d+)\)$/);
    return (m && AR[m[1]]) ? AR[m[1]] + ' (' + m[2] + ')' : null;
  }
  // translate matching text nodes + placeholders under a root (idempotent — Arabic text won't re-match)
  function translateNode(root) {
    var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1 };
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
      if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      var p = n.parentElement; if (!p || SKIP[p.tagName]) return NodeFilter.FILTER_REJECT;
      if (p.closest('[dir="ltr"],[data-noi18n],.price,.stars')) return NodeFilter.FILTER_REJECT;
      return arFor(n.nodeValue.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    } });
    var hits = [], n; while ((n = w.nextNode())) hits.push(n);
    hits.forEach(function (nd) { var k = nd.nodeValue.trim(); nd.nodeValue = nd.nodeValue.replace(k, arFor(k)); });
    (root.querySelectorAll ? root : document).querySelectorAll('[placeholder]').forEach(function (el) {
      var v = el.getAttribute('placeholder'); if (AR[v]) el.setAttribute('placeholder', AR[v]);
    });
  }
  var _observing = false, _pending = false;
  function observeDynamic() {
    if (_observing || !window.MutationObserver) return; _observing = true;
    // watch only childList (added render output) — never characterData, so our own text
    // edits can't retrigger the pass; Arabic output won't re-match AR keys anyway.
    new MutationObserver(function () {
      if (_pending) return; _pending = true;
      // setTimeout (not rAF) so it still fires when the tab is backgrounded
      setTimeout(function () { _pending = false; translateNode(document.body); }, 16);
    }).observe(document.body, { childList: true, subtree: true });
  }
  function applyLang(root) {
    if (lang !== 'ar') return;
    document.documentElement.lang = 'ar'; document.documentElement.dir = 'rtl';
    injectArFont(); translateNode(root || document.body); observeDynamic();
  }

  /* presentation maps */
  /* round category-tile images (the fun farm photos + real produce shots) */
  var IMG = { Beef: 'assets/cat/beef.webp', 'Lamb & Goat': 'assets/cat/lamb.webp', Poultry: 'assets/cat/poultry.webp', Eggs: 'assets/cat/eggs.webp', Dairy: 'assets/cat/dairy.webp', Vegetables: 'assets/cat/veg.webp', Fruit: 'assets/cat/fruit.webp', Honey: 'assets/cat/honey.webp', Livestock: 'assets/cat/livestock.webp' };
  var TINT = {};
  /* category-level fallback photo when a product's own image is missing */
  var CATIMG = { Beef: 'assets/steak.webp', 'Lamb & Goat': 'assets/steak.webp', Poultry: 'assets/chicken.webp', Eggs: 'assets/eggs.webp', Dairy: 'assets/dairy.webp', Vegetables: 'assets/tomatoes.webp', Fruit: 'assets/oranges.webp', Honey: 'assets/honey.webp', Livestock: 'assets/livestock.webp' };
  function prodImg(p) { return 'assets/products/' + p.id + '.webp'; }
  function fallbackImg(p) { return CATIMG[p.cat] || 'assets/farm-foods.webp'; }
  var ICONS = {
    Vegetables: '<svg width="54" height="54" viewBox="0 0 48 48" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M24 16c-2-6 2-10 8-10 0 6-3 10-8 10z"/><path d="M22 18c-3-2-8-1-10 3-2 5 0 14 6 18 5 3 11 1 14-4 3-6 1-14-4-17-2-1-4-1-6 0z"/></svg>',
    Fruit: '<svg width="54" height="54" viewBox="0 0 48 48" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M24 14c-6-3-14 0-15 8-1 9 6 18 12 18 2 0 2-1 3-1s1 1 3 1c6 0 13-9 12-18-1-8-9-11-15-8z"/><path d="M24 14c0-4 2-7 6-8"/></svg>',
    Honey: '<svg width="52" height="52" viewBox="0 0 48 48" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 12h18l-2 6H17z"/><path d="M17 18v16a4 4 0 004 4h6a4 4 0 004-4V18"/><path d="M24 24v7"/></svg>'
  };
  function media(p, cls) {
    return '<img class="' + (cls || '') + '" src="' + prodImg(p) + '" alt="' + esc(p.name) + '" onerror="this.onerror=null;this.src=\'' + fallbackImg(p) + '\'">';
  }
  function thumb(p, px) {
    px = px || 56;
    return '<img src="' + prodImg(p) + '" onerror="this.onerror=null;this.src=\'' + fallbackImg(p) + '\'" style="width:' + px + 'px;height:' + px + 'px;object-fit:cover;border-radius:8px">';
  }

  /* products cache (for cart display etc.) */
  var byId = {}, productsLoaded = false;
  function getProducts() {
    if (productsLoaded) return Promise.resolve(byId);
    return api('/api/products').then(function (list) { byId = {}; list.forEach(function (p) { if (lang === 'ar' && PRODAR[p.id]) p.name = PRODAR[p.id]; byId[p.id] = p; }); productsLoaded = true; LH.byId = byId; return byId; });
  }

  /* cart (localStorage) */
  var cart = {};
  try { cart = JSON.parse(localStorage.getItem('lah_cart') || '{}') || {}; } catch (e) { cart = {}; }
  function saveCart() { try { localStorage.setItem('lah_cart', JSON.stringify(cart)); } catch (e) {} updateBadge(); document.dispatchEvent(new CustomEvent('lh:cart')); }
  function cartQty() { return Object.keys(cart).reduce(function (s, k) { return s + cart[k]; }, 0); }
  function cartTotal() { return Object.keys(cart).reduce(function (s, k) { return s + (byId[k] ? byId[k].price * cart[k] : 0); }, 0); }
  function updateBadge() { var b = $('#lh-cart-count'); if (b) b.textContent = cartQty(); }
  function addToCart(id, qty) {
    cart[id] = (cart[id] || 0) + (qty || 1); saveCart();
    var el = $('#lh-cart-count'); if (el) el.parentElement.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: 260 });
    renderCart();
    open($('#lh-cart'), $('#lh-scrim-cart'));
  }
  function setQty(id, n) { if (n <= 0) delete cart[id]; else cart[id] = n; saveCart(); renderCart(); }
  function clearCart() { cart = {}; saveCart(); renderCart(); }
  function cartArray() { return Object.keys(cart).map(function (id) { return { id: id, qty: cart[id] }; }); }

  function renderCart() {
    updateBadge();
    var box = $('#lh-cart-items'); if (!box) return;
    getProducts().then(function () {
      var ids = Object.keys(cart).filter(function (id) { return byId[id]; });
      if (!ids.length) { box.innerHTML = '<div class="muted" style="text-align:center;padding:56px 0;font-size:14px">Your cart is empty.<br>Fresh from the farm is a click away.</div>'; }
      else {
        box.innerHTML = ids.map(function (id) {
          var p = byId[id];
          return '<div class="row" style="gap:12px;padding:14px 0;border-bottom:1px solid var(--line-2);align-items:center">' + thumb(p) +
            '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13.5px;line-height:1.3"><a href="product.html?id=' + id + '">' + esc(p.name) + '</a></div>' +
            '<div class="muted" style="font-size:12.5px;margin-top:2px">' + money(p.price) + '</div>' +
            '<div class="qty" style="margin-top:8px"><button data-lh-dec="' + id + '">–</button><span>' + cart[id] + '</span><button data-lh-inc="' + id + '">+</button></div></div>' +
            '<button data-lh-rm="' + id + '" aria-label="Remove" style="width:32px;height:32px;border:none;background:none;color:var(--ink-3);cursor:pointer">✕</button></div>';
        }).join('');
      }
      var tot = $('#lh-cart-total'); if (tot) tot.textContent = money(cartTotal());
    });
  }

  /* toast */
  function toast(msg) {
    var t = $('#lh-toast'); if (!t) { t = document.createElement('div'); t.id = 'lh-toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--champagne)" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' + esc(msg);
    t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  /* auth */
  var me = null;
  function loadMe() { return api('/api/auth/me').then(function (d) { me = d.user || null; return me; }).catch(function () { me = null; return null; }); }
  function logout() { return POST('/api/auth/logout').then(function () { me = null; location.href = 'index.html'; }); }

  /* ---------- chrome ---------- */
  var NAV = [
    { l: 'Shop all', href: 'index.html#shop', k: 'all' },
    { l: 'Beef', href: 'index.html?cat=Beef#shop' }, { l: 'Lamb & Goat', href: 'index.html?cat=Lamb%20%26%20Goat#shop' },
    { l: 'Poultry', href: 'index.html?cat=Poultry#shop' }, { l: 'Vegetables', href: 'index.html?cat=Vegetables#shop' },
    { l: 'Fruit', href: 'index.html?cat=Fruit#shop' }, { l: 'Livestock', href: 'index.html?cat=Livestock#shop' },
    { l: 'Reviews', href: 'index.html#reviews' }, { l: 'FAQ', href: 'index.html#faq' }
  ];
  // Footer "Popular searches" — real category-level pages (this site's home → category → item
  // hierarchy for a Shop vertical is home / cat=<Category> / product.html?id=<id>), not
  // individual products and not placeholder URLs. 8 of the 9 real categories in data.js's
  // `cats` (all but Honey, to land in the 6-8 target); same href works for both languages since
  // language here is a client-side toggle, not a separate URL — only the label translates.
  var POPULAR_SEARCHES = [
    { l: 'Fresh Beef', href: 'index.html?cat=Beef#shop' },
    { l: 'Lamb & Goat Meat', href: 'index.html?cat=Lamb%20%26%20Goat#shop' },
    { l: 'Free-Range Poultry', href: 'index.html?cat=Poultry#shop' },
    { l: 'Farm Fresh Eggs', href: 'index.html?cat=Eggs#shop' },
    { l: 'Fresh Dairy', href: 'index.html?cat=Dairy#shop' },
    { l: 'Fresh Vegetables', href: 'index.html?cat=Vegetables#shop' },
    { l: 'Seasonal Fruit', href: 'index.html?cat=Fruit#shop' },
    { l: 'Live Livestock', href: 'index.html?cat=Livestock#shop' }
  ];
  function headerHTML() {
    return '' +
    '<div class="utility"><div class="wrap">' +
      '<div class="row" style="gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--champagne)" stroke-width="1.6"><path d="M3 7h13v9H3z"/><path d="M16 10h3l2 3v3h-5z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></svg><span style="opacity:.9">Free cold-chain delivery over EGP 800 · Cairo &amp; Giza</span></div>' +
      '<div class="row" style="gap:22px;opacity:.9"><a href="#">Track order</a><a href="apply.html">Sell on Lahmetna</a><a href="#" id="lh-lang" dir="ltr">' + (lang === 'ar' ? 'EN · English' : 'AR · العربية') + '</a></div>' +
    '</div></div>' +
    '<header class="header"><div class="wrap"><div class="bar">' +
      '<button class="icon-btn hamburger" id="lh-menu" aria-label="Menu"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>' +
      '<a href="index.html" class="logo" dir="ltr"><img class="logo-mark" src="assets/logo.png" alt="Lahmetna" width="40" height="40" onerror="this.style.display=\'none\'"><span class="logo-txt"><span class="wm">lahmetna<span class="dot">.</span></span><span class="cap">YOUR EVERYDAY FARM MARKET</span></span></a>' +
      '<form class="search" id="lh-search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#917b85" stroke-width="1.7"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input type="search" name="q" placeholder="Search ribeye, free-range eggs, heirloom tomatoes…" aria-label="Search"></form>' +
      '<div class="row" style="margin-inline-start:auto;gap:16px">' +
        '<div class="acct" id="lh-acct"></div>' +
        '<button class="btn btn-ink btn-sm" id="lh-cart-btn" style="gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><path d="M4 7h15l-1.5 9H6L4 7z"/><path d="M4 7l-.8-3H1"/><circle cx="8" cy="20" r="1.4" fill="#fff" stroke="none"/><circle cx="16" cy="20" r="1.4" fill="#fff" stroke="none"/></svg>Cart · <span id="lh-cart-count">0</span></button>' +
      '</div>' +
    '</div></div>' +
    '<div class="wrap"><nav class="nav" id="lh-nav">' + NAV.map(function (n) { return '<a href="' + n.href + '"' + (n.k ? ' data-nav="' + n.k + '"' : '') + '>' + n.l + '</a>'; }).join('') +
      '<span style="margin-inline-start:auto;font-size:13px;font-weight:600;color:var(--cognac)" class="row"><span class="tag-dot"></span>This week\'s harvest</span></nav></div>' +
    '</header>';
  }
  function acctHTML() {
    if (!me) return '<a href="login.html" class="row" style="gap:7px;font-size:14px;font-weight:500"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B1714" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg><span class="acct-label">Log in</span></a>';
    var links = '';
    if (me.role === 'customer') links = '<a href="account.html">My account</a><a href="account.html#orders">Order history</a><a href="account.html#addresses">Addresses</a><a href="account.html#one">Lahmetna One</a><a href="account.html#support">Support</a>';
    else if (me.role === 'vendor') links = '<a href="vendor.html">Vendor dashboard</a><a href="vendor.html#orders">Orders</a><a href="vendor.html#earnings">Earnings</a><a href="vendor.html#awal">Lahmetna Awal</a><a href="vendor.html#support">Support</a>';
    else if (me.role === 'admin') links = '<a href="admin.html">Admin console</a><a href="admin.html#support">Support queue</a><a href="admin.html#payouts">Payouts</a><a href="admin.html#settings">Settings</a>';
    return '<button class="row" id="lh-acct-btn" style="gap:7px;font-size:14px;font-weight:500;background:none;border:none;cursor:pointer;color:var(--ink)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B1714" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg><span class="acct-label">' + esc(me.name.split(' ')[0]) + '</span></button>' +
      '<div class="acct-menu" id="lh-acct-menu" hidden><div class="who"><div class="n">' + esc(me.name) + '</div><div class="e">' + esc(me.email) + ' · ' + me.role + '</div></div><div class="sep"></div>' + links + '<div class="sep"></div><button id="lh-logout">Log out</button></div>';
  }
  function footerHTML() {
    return '<footer class="footer"><div class="wrap"><div class="cols">' +
      '<div><a href="index.html" class="logo" dir="ltr"><span class="wm" style="font-size:30px">lahmetna<span class="dot">.</span></span></a>' +
      '<p class="muted" style="font-size:13.5px;line-height:1.6;margin-top:16px;max-width:280px">The marketplace for naturally raised meat and fresh farm produce, direct from named farms across Egypt.</p>' +
      '<div class="row" style="gap:10px;margin-top:18px"><span class="pill">Cash on delivery</span><span class="pill">Visa · Meeza · PayTabs</span></div></div>' +
      '<div><h4>Shop</h4><div class="links"><a href="index.html?cat=Beef#shop">Beef</a><a href="index.html?cat=Lamb%20%26%20Goat#shop">Lamb &amp; Goat</a><a href="index.html?cat=Poultry#shop">Poultry &amp; Eggs</a><a href="index.html?cat=Vegetables#shop">Vegetables &amp; Fruit</a><a href="index.html?cat=Livestock#shop">Livestock</a></div></div>' +
      '<div><h4>Company</h4><div class="links"><a href="apply.html">Sell on Lahmetna</a><a href="index.html#faq">How it works</a><a href="#">Sustainability</a><a href="#">Careers</a></div></div>' +
      '<div><h4>Help</h4><div class="links"><a href="index.html#faq">FAQs</a><a href="contact.html">Contact us</a><a href="help">Help centre</a><a href="legal.html?doc=shipping">Delivery &amp; cold-chain</a><a href="legal.html?doc=refunds">Returns &amp; refunds</a><a href="editorial-guidelines">Editorial guidelines</a><a href="login.html">My account</a></div></div>' +
      '<div><h4>Popular searches</h4><div class="links">' + POPULAR_SEARCHES.map(function (s) { return '<a href="' + s.href + '">' + esc(t(s.l)) + '</a>'; }).join('') + '</div></div>' +
      '</div><div class="base"><span>© 2026 Lahmetna. Raised right, priced fair.</span><div class="row" style="gap:22px;flex-wrap:wrap"><a href="legal.html?doc=privacy">Privacy</a><a href="legal.html?doc=terms">Terms</a><a href="legal.html?doc=cookies">Cookies</a><a href="legal.html?doc=halal">Halal certification</a></div></div></div></footer>';
  }
  function cartHTML() {
    return '<div class="scrim-full" id="lh-scrim-cart"></div>' +
    '<aside class="drawer" id="lh-cart" aria-label="Cart"><div class="row between" style="padding:20px 22px;border-bottom:1px solid var(--line)"><strong class="display" style="font-size:18px">Your cart</strong><button class="icon-btn" id="lh-cart-close" aria-label="Close">✕</button></div>' +
      '<div id="lh-cart-items" style="flex:1;overflow:auto;padding:8px 22px"></div>' +
      '<div style="padding:20px 22px;border-top:1px solid var(--line);background:var(--paper)"><div class="row between"><span class="muted">Subtotal</span><strong class="display" style="font-size:20px" id="lh-cart-total">EGP 0</strong></div>' +
      '<div class="muted" style="font-size:12.5px;margin-top:4px">Delivery calculated at checkout · free over EGP 800</div>' +
      '<a class="btn btn-primary btn-block" id="lh-checkout" href="checkout.html" style="margin-top:14px">Checkout</a></div></aside>';
  }
  function mnavHTML() {
    return '<div class="scrim-full" id="lh-scrim-menu"></div><div class="mnav" id="lh-mnav"><div class="row between" style="margin-bottom:12px"><span class="brand" style="font-size:28px">lahmetna<span style="color:var(--gold)">.</span></span><button class="icon-btn" id="lh-mnav-close">✕</button></div>' +
      NAV.map(function (n) { return '<a href="' + n.href + '">' + n.l + '</a>'; }).join('') + '<a href="apply.html">Sell on Lahmetna</a></div>';
  }

  function open(el, sc) { if (el) el.classList.add('show'); if (sc) sc.classList.add('show'); }
  function close(el, sc) { if (el) el.classList.remove('show'); if (sc) sc.classList.remove('show'); }

  function mountChrome(opts) {
    opts = opts || {};
    var h = document.getElementById('site-header') || document.body.insertBefore(document.createElement('div'), document.body.firstChild);
    h.id = 'site-header'; h.innerHTML = headerHTML();
    var f = document.getElementById('site-footer') || document.body.appendChild(document.createElement('div'));
    f.id = 'site-footer'; f.innerHTML = footerHTML();
    document.body.insertAdjacentHTML('beforeend', cartHTML() + mnavHTML());
    // active nav
    if (opts.active) { var a = h.querySelector('.nav a[data-nav="' + opts.active + '"]'); if (a) a.classList.add('active'); }
    // acct
    renderAcct();
    // search
    var sf = $('#lh-search'); if (sf) sf.addEventListener('submit', function (e) { e.preventDefault(); var v = this.q.value.trim(); location.href = 'index.html?q=' + encodeURIComponent(v) + '#shop'; });
    // cart
    $('#lh-cart-btn').addEventListener('click', function () { renderCart(); open($('#lh-cart'), $('#lh-scrim-cart')); });
    $('#lh-cart-close').addEventListener('click', function () { close($('#lh-cart'), $('#lh-scrim-cart')); });
    $('#lh-scrim-cart').addEventListener('click', function () { close($('#lh-cart'), $('#lh-scrim-cart')); });
    $('#lh-checkout').addEventListener('click', function (e) { if (!cartQty()) { e.preventDefault(); toast('Your cart is empty'); } });
    // menu
    $('#lh-menu').addEventListener('click', function () { open($('#lh-mnav'), $('#lh-scrim-menu')); });
    $('#lh-mnav-close').addEventListener('click', function () { close($('#lh-mnav'), $('#lh-scrim-menu')); });
    $('#lh-scrim-menu').addEventListener('click', function () { close($('#lh-mnav'), $('#lh-scrim-menu')); });
    // cart qty delegation
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-lh-inc],[data-lh-dec],[data-lh-rm]'); if (!t) return;
      if (t.dataset.lhInc) setQty(t.dataset.lhInc, (cart[t.dataset.lhInc] || 0) + 1);
      else if (t.dataset.lhDec) setQty(t.dataset.lhDec, (cart[t.dataset.lhDec] || 0) - 1);
      else if (t.dataset.lhRm) setQty(t.dataset.lhRm, 0);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { close($('#lh-cart'), $('#lh-scrim-cart')); close($('#lh-mnav'), $('#lh-scrim-menu')); var mnu = $('#lh-acct-menu'); if (mnu) mnu.hidden = true; } });
    // condense the sticky header into a compact bar once scrolled (search, account & cart stay pinned)
    var hdr = h.querySelector('.header');
    if (hdr) { var onScroll = function () { hdr.classList.toggle('compact', window.scrollY > 140); }; window.addEventListener('scroll', onScroll, { passive: true }); onScroll(); }
    // language toggle
    var lg = $('#lh-lang'); if (lg) lg.addEventListener('click', function (e) { e.preventDefault(); setLang(lang === 'ar' ? 'en' : 'ar'); });
    applyLang();
    updateBadge();
  }
  function renderAcct() {
    var box = $('#lh-acct'); if (!box) return;
    box.innerHTML = acctHTML();
    if (me) {
      $('#lh-acct-btn').addEventListener('click', function (e) { e.stopPropagation(); var mnu = $('#lh-acct-menu'); mnu.hidden = !mnu.hidden; });
      document.addEventListener('click', function () { var mnu = $('#lh-acct-menu'); if (mnu) mnu.hidden = true; });
      $('#lh-logout').addEventListener('click', logout);
    }
  }

  /* boot: load auth, mount chrome */
  function boot(opts) { return loadMe().then(function () { mountChrome(opts || {}); return me; }); }

  /* ---------- shared dashboard helpers ---------- */
  function card(v, k) { return '<div class="stat-card"><div class="v">' + v + '</div><div class="k">' + k + '</div></div>'; }
  function st(s) { return '<span class="st st-' + esc(s) + '">' + esc(s) + '</span>'; }
  var CROWN = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7l4 4 5-7 5 7 4-4v11H3z"/></svg>';
  function planBadge(plan) {
    if (plan === 'one') return '<span class="plan-badge">' + CROWN + 'Lahmetna One</span>';
    if (plan === 'awal') return '<span class="plan-badge">' + CROWN + 'Lahmetna Awal</span>';
    return '';
  }
  /* renders a ticket message thread; mineRole decides bubble side */
  function ticketThread(msgs, meId) {
    return '<div class="thread">' + (msgs || []).map(function (m) {
      var mine = m.author_id === meId;
      var who = m.author_role === 'admin' ? 'Lahmetna support' : (mine ? 'You' : 'You');
      return '<div class="msg ' + (mine ? 'mine' : 'them') + '"><div class="who">' + esc(who) + ' · ' + esc((m.created || '').slice(0, 16).replace('T', ' ')) + '</div>' + esc(m.body).replace(/\n/g, '<br>') + '</div>';
    }).join('') + '</div>';
  }
  /* generic tab router used by the three dashboards */
  function tabs(handlers, def) {
    var buttons = document.querySelectorAll('.dash-nav button');
    function go(t) {
      if (!handlers[t]) t = def;
      buttons.forEach(function (b) { b.classList.toggle('active', b.dataset.tab === t); });
      if (location.hash.slice(1) !== t) history.replaceState(null, '', '#' + t);
      handlers[t]();
    }
    buttons.forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.tab); }); });
    window.addEventListener('hashchange', function () { go(location.hash.slice(1)); });
    go(location.hash.slice(1) || def);
    return go;
  }
  /* generic centered modal from an id already in the DOM */
  function modal(html) {
    var sc = $('#lh-mscrim') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'lh-mscrim', className: 'scrim-full' }));
    var mo = $('#lh-modal') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'lh-modal', className: 'modal' }));
    mo.innerHTML = html;
    function shut() { close(mo, sc); }
    sc.onclick = shut;
    mo.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', shut); });
    open(mo, sc);
    return { el: mo, close: shut };
  }

  return {
    $: $, esc: esc, money: money, stars: stars, api: api, POST: POST, toast: toast,
    IMG: IMG, TINT: TINT, ICONS: ICONS, media: media, thumb: thumb,
    getProducts: getProducts, byId: byId,
    get cart() { return cart; }, cartArray: cartArray, addToCart: addToCart, cartQty: cartQty, cartTotal: cartTotal, clearCart: clearCart, renderCart: renderCart,
    loadMe: loadMe, logout: logout, get me() { return me; },
    boot: boot, mountChrome: mountChrome, open: open, close: close,
    get lang() { return lang; }, t: t, setLang: setLang, applyLang: applyLang, tFaq: tFaq,
    arName: function (id) { return (lang === 'ar' && PRODAR[id]) ? PRODAR[id] : null; },
    card: card, st: st, planBadge: planBadge, ticketThread: ticketThread, tabs: tabs, modal: modal
  };
})();
