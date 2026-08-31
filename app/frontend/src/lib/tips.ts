/**
 * Curated bilingual micro-tips (spec §3.11.1) — static content shipped
 * with the app, no CMS, no network. Updating tips is a data change: edit
 * this array and redeploy. No tracking of which tips a household has read.
 *
 * `context` values used by <ContextualTip>: "investments", "tax", or
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
]

export function tipsForContext(context: string): Tip[] {
  return TIPS.filter((t) => t.context === context)
}
