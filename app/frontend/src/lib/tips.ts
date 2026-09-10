/**
 * Curated bilingual micro-tips (spec §3.11.1) — static content shipped
 * with the app, no CMS, no network. Updating tips is a data change: edit
 * this array and redeploy. No tracking of which tips a household has read.
 *
 * `context` values used by <ContextualTip>: "general" (not tied to any one
 * screen — HomeScreen and ExpenseEntryPanel), "investments", "tax", or
 * "category:<name_en>" matching a top-level category from seed_defaults.py.
 */

export interface Tip {
  id: string
  context: string
  title_en: string
  title_bn: string
  body_en: string
  body_bn: string
}

export const TIPS: Tip[] = [
  {
    id: 'dps-rebate',
    context: 'investments',
    title_en: 'DPS installments count toward your tax rebate',
    title_bn: 'ডিপিএস কিস্তি আপনার কর রেয়াতে যোগ হয়',
    body_en: 'Mark a DPS as "tax rebate eligible" when you add it — the amount then feeds your tax estimate automatically, no separate entry.',
    body_bn: 'ডিপিএস যোগ করার সময় "কর রেয়াতযোগ্য" চিহ্নিত করুন — তাহলে পরিমাণটি স্বয়ংক্রিয়ভাবে আপনার কর হিসাবে যোগ হবে, আলাদা এন্ট্রির দরকার নেই।',
  },
  {
    id: 'fdr-renewal',
    context: 'investments',
    title_en: "FDR rates change at renewal — check before you auto-renew",
    title_bn: 'নবায়নের সময় FDR-এর হার বদলাতে পারে — স্বয়ংক্রিয় নবায়নের আগে যাচাই করুন',
    body_en: "Banks often renew a matured FDR at a lower rate than the original. Compare before enabling auto-renewal.",
    body_bn: 'ব্যাংক প্রায়ই মেয়াদপূর্তির পর কম হারে FDR নবায়ন করে। স্বয়ংক্রিয় নবায়ন চালু করার আগে হার তুলনা করুন।',
  },
  {
    id: 'tax-rebate-cap',
    context: 'tax',
    title_en: 'The investment rebate has a cap — more isn’t always better',
    title_bn: 'বিনিয়োগ রেয়াতের একটি সীমা আছে — বেশি বিনিয়োগ সবসময় বেশি রেয়াত মানে না',
    body_en: 'NBR caps how much of your investment counts toward the rebate. Check the breakdown below — investing beyond the cap still builds savings, just without an extra tax benefit.',
    body_bn: 'আপনার বিনিয়োগের কত অংশ রেয়াতে গণনা হবে তার একটি সীমা NBR নির্ধারণ করে। নিচের হিসাব দেখুন — সীমার বেশি বিনিয়োগ সঞ্চয় বাড়ায়, তবে বাড়তি কর সুবিধা দেয় না।',
  },
  {
    id: 'tax-unverified',
    context: 'tax',
    title_en: 'These figures use unverified slab rates',
    title_bn: 'এই হিসাবে অযাচাইকৃত স্ল্যাব হার ব্যবহৃত হয়েছে',
    body_en: 'Confirm the current NBR slabs before relying on this estimate for a filing decision.',
    body_bn: 'ফাইলিং সিদ্ধান্তের জন্য এই হিসাবের উপর নির্ভর করার আগে বর্তমান NBR স্ল্যাব যাচাই করুন।',
  },
  {
    id: 'grocery-seasonal',
    context: 'category:Grocery & Food',
    title_en: 'Bazar prices swing with the season',
    title_bn: 'ঋতুভেদে বাজারদর ওঠানামা করে',
    body_en: 'Vegetable and fish prices often spike before Eid and during monsoon. A wider budget in those months avoids a false "overspend" alarm.',
    body_bn: 'ঈদের আগে ও বর্ষায় সবজি-মাছের দাম প্রায়ই বেড়ে যায়। ওই মাসগুলোতে একটু বাড়তি বাজেট রাখলে অকারণ "বাড়তি খরচ" সতর্কতা এড়ানো যায়।',
  },
  {
    id: 'housing-rollover',
    context: 'category:Housing',
    title_en: 'Rent is fixed — turn rollover off for it',
    title_bn: 'ভাড়া নির্দিষ্ট — এর জন্য রোলওভার বন্ধ রাখুন',
    body_en: 'Categories with a near-constant monthly cost like rent rarely benefit from rollover. Save it for irregular categories instead.',
    body_bn: 'ভাড়ার মতো প্রায় স্থির মাসিক খরচের ক্যাটাগরিতে রোলওভারের তেমন উপকার নেই। এটি বরং অনিয়মিত খরচের ক্যাটাগরির জন্য রাখুন।',
  },
  {
    id: 'utilities-mobile',
    context: 'category:Utilities',
    title_en: 'Mobile recharge adds up in small pieces',
    title_bn: 'মোবাইল রিচার্জ ছোট ছোট করে জমে অনেক হয়ে যায়',
    body_en: 'Frequent small recharges are easy to undercount. Logging each one, even ৳20, keeps this category honest.',
    body_bn: 'ঘন ঘন ছোট রিচার্জ হিসাবের বাইরে থেকে যায় সহজেই। ৳২০ হলেও প্রতিটি লিখে রাখলে এই ক্যাটাগরি সঠিক থাকে।',
  },
  {
    id: 'transport-recurring',
    context: 'category:Transport',
    title_en: 'A fixed commute cost? Make it recurring',
    title_bn: 'যাতায়াতের খরচ নির্দিষ্ট হলে সেটা নিয়মিত করে দিন',
    body_en: 'A monthly bus pass or a fixed rickshaw arrangement is a good candidate for a recurring entry — one tap to mark paid each month.',
    body_bn: 'মাসিক বাস পাস বা নির্দিষ্ট রিকশা ভাড়া নিয়মিত এন্ট্রির জন্য উপযুক্ত — প্রতি মাসে এক ট্যাপে পরিশোধ চিহ্নিত করা যায়।',
  },
  {
    id: 'health-insurance',
    context: 'category:Health & Medical',
    title_en: 'Health insurance premiums can be tax-deductible',
    title_bn: 'স্বাস্থ্য বীমার প্রিমিয়াম করযোগ্য আয় থেকে বাদ যেতে পারে',
    body_en: 'If your household has a health insurance policy, log the premium as a deduction on the Income & Tax screen.',
    body_bn: 'আপনার পরিবারের স্বাস্থ্য বীমা থাকলে প্রিমিয়ামটি আয় ও কর স্ক্রিনে কর্তন হিসেবে যোগ করুন।',
  },
  {
    id: 'childcare-milestones',
    context: 'category:Child Care',
    title_en: 'Child costs shift fast in the early years',
    title_bn: 'ছোট বাচ্চার খরচ শুরুর বছরগুলোতে দ্রুত বদলায়',
    body_en: 'Diaper and formula spend usually drops as feeding costs rise. Revisit this category’s budget every few months rather than setting it once.',
    body_bn: 'ডায়াপার ও ফর্মুলার খরচ কমার সাথে সাথে খাবারের খরচ বাড়ে সাধারণত। এই ক্যাটাগরির বাজেট একবার সেট করে না রেখে কয়েক মাস পরপর দেখে নিন।',
  },
  {
    id: 'education-lumpy',
    context: 'category:Education',
    title_en: 'School fees rarely arrive evenly',
    title_bn: 'স্কুল ফি সাধারণত সমানভাবে আসে না',
    body_en: 'Admission and exam fees tend to land in specific months. Rollover keeps this category’s budget from looking "unused" the rest of the year.',
    body_bn: 'ভর্তি ও পরীক্ষার ফি নির্দিষ্ট মাসগুলোতে আসে। রোলওভার চালু রাখলে বছরের বাকি সময় এই ক্যাটাগরি "অব্যবহৃত" মনে হবে না।',
  },
  {
    id: 'festivals-plan-ahead',
    context: 'category:Festivals & Entertainment',
    title_en: 'Eid spending is easier to absorb when it’s expected',
    title_bn: 'ঈদের খরচ আগে থেকে ধরে রাখলে সামলানো সহজ হয়',
    body_en: 'A small monthly rollover into this category ahead of Eid softens the spike when it arrives.',
    body_bn: 'ঈদের আগে প্রতি মাসে একটু করে এই ক্যাটাগরিতে জমালে ঈদের সময়ের বাড়তি খরচ সামলানো সহজ হয়।',
  },
  {
    id: 'loans-emi-first',
    context: 'category:Loans & EMI',
    title_en: 'Pay this before anything discretionary',
    title_bn: 'ঐচ্ছিক খরচের আগে এটি পরিশোধ করুন',
    body_en: 'Loan EMIs and credit card minimums protect your credit standing. The Debts screen shows an avalanche-vs-snowball comparison if you have more than one.',
    body_bn: 'ঋণের কিস্তি ও ক্রেডিট কার্ডের ন্যূনতম পরিশোধ আপনার ক্রেডিট রেকর্ড রক্ষা করে। একাধিক ঋণ থাকলে ঋণ স্ক্রিনে অ্যাভাল্যাঞ্চ বনাম স্নোবল তুলনা দেখুন।',
  },
  {
    id: 'savings-first',
    context: 'category:Savings & Investment',
    title_en: 'Treat savings like a bill, not a leftover',
    title_bn: 'সঞ্চয়কে বিলের মতো ভাবুন, উদ্বৃত্ত নয়',
    body_en: 'Households that budget savings before discretionary spend save more consistently than those who save "whatever is left."',
    body_bn: 'যারা ঐচ্ছিক খরচের আগেই সঞ্চয়ের বাজেট রাখে, তারা "যা বাঁচে তাই জমাই" ভাবার চেয়ে বেশি নিয়মিত সঞ্চয় করে।',
  },
  {
    id: 'onetime-buffer',
    context: 'category:One-time/Irregular',
    title_en: 'This category is your shock absorber',
    title_bn: 'এই ক্যাটাগরি আপনার আকস্মিক খরচ শোষক',
    body_en: 'A furniture repair or a sudden appliance replacement belongs here, not squeezed into a monthly category it will blow past.',
    body_bn: 'আসবাবপত্র মেরামত বা হঠাৎ যন্ত্রপাতি বদলানোর খরচ এখানেই রাখুন, অন্য মাসিক ক্যাটাগরিতে ঠেসে দিলে সেটি ছাড়িয়ে যাবে।',
  },
  {
    id: 'general-log-small',
    context: 'general',
    title_en: 'Small expenses add up — log them too',
    title_bn: 'ছোট খরচও জমে অনেক হয়ে যায় — সেগুলোও লিখে রাখুন',
    body_en: 'A ৳20 tea or a rickshaw fare feels too small to note, but skipping small entries is the most common way a budget quietly drifts.',
    body_bn: '৳২০ টাকার চা বা রিকশা ভাড়া লেখার মতো ছোট মনে হতে পারে, কিন্তু ছোট খরচ বাদ দেওয়াই বাজেট চুপচাপ ভুল হয়ে যাওয়ার সবচেয়ে সাধারণ কারণ।',
  },
  {
    id: 'general-offline',
    context: 'general',
    title_en: 'No signal? Log it anyway',
    title_bn: 'নেটওয়ার্ক নেই? তবুও লিখে রাখুন',
    body_en: 'An expense you log with no internet is saved on your phone and syncs automatically the next time you\'re online — nothing is lost.',
    body_bn: 'ইন্টারনেট ছাড়া লেখা খরচ আপনার ফোনে সংরক্ষিত থাকে এবং পরের বার অনলাইনে এলে নিজে থেকেই সিঙ্ক হয়ে যায় — কিছুই হারায় না।',
  },
  {
    id: 'general-for-member',
    context: 'general',
    title_en: '"For" isn\'t "who paid" — it\'s who it was for',
    title_bn: '"জন্য" মানে "কে টাকা দিয়েছে" নয় — এটি কার জন্য খরচ হয়েছে',
    body_en: 'Logging an expense against the right family member keeps each person\'s spending and allowance totals accurate, even if someone else paid.',
    body_bn: 'সঠিক পরিবারের সদস্যের নামে খরচ লিখলে সেই ব্যক্তির খরচ ও ভাতার হিসাব ঠিক থাকে, অন্য কেউ টাকা দিলেও।',
  },
  {
    id: 'general-budget-warning',
    context: 'general',
    title_en: 'A budget warning is a nudge, not a lock',
    title_bn: 'বাজেট সতর্কতা একটি ইঙ্গিত মাত্র, বাধা নয়',
    body_en: 'Crossing 75% or 95% of a category\'s budget shows a soft warning — it never blocks logging. You stay in control of the decision.',
    body_bn: 'কোনো ক্যাটাগরির বাজেটের ৭৫% বা ৯৫% পেরোলে একটি মৃদু সতর্কতা দেখানো হয় — এটি কখনো খরচ লিখতে বাধা দেয় না। সিদ্ধান্ত সবসময় আপনার হাতে থাকে।',
  },
  {
    id: 'general-transliteration',
    context: 'general',
    title_en: 'Type in English, get Bangla script',
    title_bn: 'ইংরেজিতে লিখুন, বাংলা লিপি পান',
    body_en: 'Typing "bazar" in a description and tapping অআ converts it to বাজার — handy if Bangla typing isn\'t set up on your phone.',
    body_bn: 'বর্ণনায় "bazar" লিখে অআ চাপলে সেটি বাজার-এ রূপান্তরিত হয় — ফোনে বাংলা টাইপিং সেট করা না থাকলে কাজে লাগে।',
  },
  {
    id: 'general-recurring',
    context: 'general',
    title_en: 'Pay the same bill every month? Make it recurring',
    title_bn: 'প্রতি মাসে একই বিল দেন? এটি নিয়মিত করে দিন',
    body_en: 'A recurring rule reminds you when a bill is due and logs the expense in one tap when you mark it paid — no retyping the same entry.',
    body_bn: 'নিয়মিত এন্ট্রি বিলের সময় হলে মনে করিয়ে দেয় এবং পরিশোধ চিহ্নিত করলে এক ট্যাপেই খরচ লিখে ফেলে — একই এন্ট্রি বারবার লেখার দরকার নেই।',
  },
  // Quotes from well-known personal finance writers and figures - shown
  // alongside the practical general tips above, same context so they
  // rotate together on the dashboard and the log-expense form.
  {
    id: 'quote-buffett-save',
    context: 'general',
    title_en: 'Do not save what is left after spending, but spend what is left after saving.',
    title_bn: 'যা খরচের পর বেঁচে যায় তা সঞ্চয় করবেন না, বরং যা সঞ্চয়ের পর বেঁচে যায় তা খরচ করুন।',
    body_en: '— Warren Buffett, investor',
    body_bn: '— ওয়ারেন বাফেট, বিনিয়োগকারী',
  },
  {
    id: 'quote-franklin-leak',
    context: 'general',
    title_en: 'Beware of little expenses; a small leak will sink a great ship.',
    title_bn: 'ছোট খরচের ব্যাপারে সতর্ক থাকুন; একটি ছোট ছিদ্রই একটি বড় জাহাজ ডুবিয়ে দিতে পারে।',
    body_en: '— Benjamin Franklin',
    body_bn: '— বেঞ্জামিন ফ্র্যাঙ্কলিন',
  },
  {
    id: 'quote-ramsey-budget',
    context: 'general',
    title_en: "A budget is telling your money where to go instead of wondering where it went.",
    title_bn: 'বাজেট মানে আপনার টাকাকে আগেই বলে দেওয়া কোথায় যেতে হবে — পরে ভাবার বদলে যে টাকাটা গেল কোথায়।',
    body_en: '— Dave Ramsey, personal finance author',
    body_bn: '— ডেভ র‍্যামসি, ব্যক্তিগত অর্থ বিষয়ক লেখক',
  },
  {
    id: 'quote-kiyosaki-keep',
    context: 'general',
    title_en: "It's not how much money you make, but how much money you keep.",
    title_bn: 'আপনি কত আয় করছেন সেটা বড় কথা নয়, কত টাকা ধরে রাখতে পারছেন সেটাই আসল।',
    body_en: '— Robert Kiyosaki, author of Rich Dad Poor Dad',
    body_bn: '— রবার্ট কিয়োসাকি, Rich Dad Poor Dad বইয়ের লেখক',
  },
  {
    id: 'quote-orman-people',
    context: 'general',
    title_en: 'People first, then money, then things.',
    title_bn: 'প্রথমে মানুষ, তারপর টাকা, তারপর জিনিসপত্র।',
    body_en: '— Suze Orman, personal finance author',
    body_bn: '— সুজ ওরম্যান, ব্যক্তিগত অর্থ বিষয়ক লেখক',
  },
  {
    id: 'quote-munger-spend-less',
    context: 'general',
    title_en: 'Spend less than you earn; always be saving something.',
    title_bn: 'যা আয় করেন তার চেয়ে কম খরচ করুন; সবসময় কিছু না কিছু সঞ্চয় করুন।',
    body_en: '— Charlie Munger, investor',
    body_bn: '— চার্লি মাঙ্গার, বিনিয়োগকারী',
  },
  {
    id: 'quote-rogers-impress',
    context: 'general',
    title_en: "Too many people spend money they haven't earned, to buy things they don't want, to impress people they don't like.",
    title_bn: 'অনেকেই এমন টাকা খরচ করেন যা তারা উপার্জনই করেননি, এমন জিনিস কিনতে যা তাদের দরকার নেই, এমন মানুষকে মুগ্ধ করতে যাদের তারা পছন্দও করেন না।',
    body_en: '— Will Rogers, humorist',
    body_bn: '— উইল রজার্স, রম্যলেখক',
  },
  {
    id: 'quote-sethi-rich-life',
    context: 'general',
    title_en: 'A rich life means spending extravagantly on the things you love, and cutting costs mercilessly on the things you don\'t.',
    title_bn: 'সমৃদ্ধ জীবন মানে যা ভালোবাসেন তাতে প্রাণ খুলে খরচ করা, আর যা ভালো লাগে না তাতে নির্মমভাবে খরচ কমানো।',
    body_en: '— Ramit Sethi, author of I Will Teach You to Be Rich',
    body_bn: '— রামিত শেঠি, I Will Teach You to Be Rich বইয়ের লেখক',
  },
]

export function tipsForContext(context: string): Tip[] {
  return TIPS.filter((t) => t.context === context)
}
