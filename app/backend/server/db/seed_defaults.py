"""Default category tree (spec §3.3.2) and payment methods (spec §3.4.4).

This is SEED DATA, not an enum: users rename, archive, and extend it freely
after first run. Per-member medical is deliberately NOT a category - it is a
filter on Health by member (v1.0's parallel tree double-counted in reports).
"""

# (icon, name_en, name_bn, [(sub_en, sub_bn), ...])
DEFAULT_CATEGORIES: list[tuple[str, str, str, list[tuple[str, str]]]] = [
    ("🏠", "Housing", "আবাসন", [
        ("Rent", "বাসা ভাড়া"),
        ("Service Charge", "সার্ভিস চার্জ"),
        ("Gas", "গ্যাস"),
        ("Maintenance", "বাড়ি মেরামত"),
    ]),
    ("⚡", "Utilities", "ইউটিলিটি", [
        ("Electricity", "বিদ্যুৎ"),
        ("Internet", "ইন্টারনেট"),
        ("Water", "পানি"),
        ("Mobile", "মোবাইল রিচার্জ"),
    ]),
    ("🛒", "Grocery & Food", "বাজার ও খাবার", [
        ("Fish & Meat", "বাজার - মাছ/মাংস"),
        ("Vegetables", "বাজার - সবজি"),
        ("Staples", "বাজার - চাল/ডাল"),
        ("Fruits", "বাজার - ফল"),
        ("Outside Food", "বাইরের খাবার"),
        ("Kitchen Items", "রান্নাঘর সামগ্রী"),
    ]),
    ("👶", "Child Care", "শিশু পরিচর্যা", [
        ("Baby Food", "শিশু খাবার"),
        ("Diaper", "ডায়াপার"),
        ("Baby Medical", "শিশু চিকিৎসা"),
        ("Toys & Books", "খেলনা ও বই"),
        ("Baby Clothes", "শিশু পোশাক"),
    ]),
    ("🏫", "Education", "শিক্ষা", [
        ("School Fees", "স্কুল ফি"),
        ("Tuition", "টিউশন"),
        ("Books & Stationery", "বই ও স্টেশনারি"),
        ("Coaching", "কোচিং"),
    ]),
    ("🏥", "Health & Medical", "স্বাস্থ্য", [
        ("Medicine", "ওষুধ"),
        ("Doctor Fees", "ডাক্তার ফি"),
        ("Lab Tests", "ল্যাব টেস্ট"),
        ("Hospital Commute", "হাসপাতাল যাতায়াত"),
        ("Health Insurance", "স্বাস্থ্য বীমা"),
    ]),
    ("🚗", "Transport", "যানবাহন", [
        ("Motorcycle Oil", "মোটরসাইকেল তেল"),
        ("Rickshaw/Ride", "রিকশা/উবার"),
        ("Public Transport", "বাস/পাবলিক"),
        ("Vehicle Maintenance", "গাড়ি রক্ষণাবেক্ষণ"),
    ]),
    ("👗", "Clothing", "পোশাক", [
        ("Personal Clothing", "নিজের পোশাক"),
        ("Family Clothing", "পরিবারের পোশাক"),
        ("Festival Clothing", "ঈদ/উৎসব পোশাক"),
    ]),
    ("👨‍👩‍👧‍👦", "Family Allowances", "পারিবারিক ভাতা", [
        ("Domestic Help", "গৃহকর্মী / বুয়া"),
    ]),
    ("🎉", "Festivals & Entertainment", "উৎসব ও বিনোদন", [
        ("Eid Expenses", "ঈদ খরচ"),
        ("Entertainment", "বিনোদন"),
        ("Gifts", "উপহার"),
    ]),
    ("💳", "Loans & EMI", "ঋণ ও EMI", [
        ("Bank Loan", "ব্যাংক লোন"),
        ("Credit Card", "ক্রেডিট কার্ড"),
        ("Personal Loan", "ব্যক্তিগত ঋণ"),
    ]),
    ("💰", "Savings & Investment", "সঞ্চয় ও বিনিয়োগ", [
        ("Pension/PF", "পেনশন/প্রভিডেন্ট"),
        ("DPS/Savings", "জমানো"),
        ("Sanchayapatra", "সঞ্চয়পত্র"),
        ("Mutual Fund", "মিউচুয়াল ফান্ড"),
    ]),
    ("🏗", "One-time/Irregular", "এককালীন খরচ", [
        ("Furniture", "আসবাবপত্র"),
        ("Electronics", "ইলেকট্রনিক্স"),
        ("Home Renovation", "বাড়ি সংস্কার"),
    ]),
]

# (name, name_bn, icon)
DEFAULT_PAYMENT_METHODS: list[tuple[str, str | None, str]] = [
    ("Cash", "নগদ", "💵"),
    ("bKash", None, "📱"),
    ("Nagad", None, "📱"),
    ("Rocket", None, "📱"),
    ("Credit Card", "ক্রেডিট কার্ড", "💳"),
    ("Debit Card", "ডেবিট কার্ড", "💳"),
    ("Bank Transfer", "ব্যাংক ট্রান্সফার", "🏦"),
]
