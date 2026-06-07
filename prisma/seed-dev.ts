import { prisma } from "@/lib";
import { CURRENCY_LOCALE_MAP, CURRENCY_OPTIONS, LANGUAGE_OPTIONS, THEME_OPTIONS, ZERO_DECIMAL_CURRENCIES } from "@/static";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Starting database seeding...\n");

  // ============================================
  // 1. CLEAN EXISTING DATA
  // ============================================
  console.log("🧹 Cleaning existing data...");
  await prisma.recurringTransaction.deleteMany({});
  await prisma.budget.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.goal.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.user.deleteMany({ where: { email: "demo@finance.com" } });
  console.log("✅ Clean done\n");

  // ============================================
  // 2. CREATE DEMO USER
  // ============================================
  console.log("👤 Creating demo user...");
  const hashedPassword = await bcrypt.hash("password123", 10);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@finance.com" },
    update: {},
    create: {
      email: "demo@finance.com",
      password: hashedPassword,
      name: "Demo User",
      avatar: null,
      avatarFileId: null,
    },
  });
  console.log("✅ Demo user created: demo@finance.com / password123\n");

  // ============================================
  // 3. CREATE DEFAULT CATEGORIES
  // ============================================
  console.log("📁 Creating default categories...");

  const defaultCategories = [
    // Income
    { name: "Salary", type: "INCOME", icon: "💰", color: "#10B981", isDefault: true },
    { name: "Bonus", type: "INCOME", icon: "🎁", color: "#3B82F6", isDefault: false },
    { name: "Investment", type: "INCOME", icon: "📈", color: "#8B5CF6", isDefault: false },
    { name: "Freelance", type: "INCOME", icon: "💼", color: "#F59E0B", isDefault: false },
    { name: "Business", type: "INCOME", icon: "🏪", color: "#06B6D4", isDefault: false },
    { name: "Gift", type: "INCOME", icon: "🎉", color: "#EC4899", isDefault: false },
    { name: "Other Income", type: "INCOME", icon: "💵", color: "#6B7280", isDefault: false },
    // Expense
    { name: "Food & Drinks", type: "EXPENSE", icon: "🍔", color: "#EF4444", isDefault: true },
    { name: "Transportation", type: "EXPENSE", icon: "🚗", color: "#F59E0B", isDefault: false },
    { name: "Shopping", type: "EXPENSE", icon: "🛒", color: "#8B5CF6", isDefault: false },
    { name: "Entertainment", type: "EXPENSE", icon: "🎬", color: "#EC4899", isDefault: false },
    { name: "Bills & Utilities", type: "EXPENSE", icon: "📄", color: "#6366F1", isDefault: false },
    { name: "Healthcare", type: "EXPENSE", icon: "⚕️", color: "#14B8A6", isDefault: false },
    { name: "Education", type: "EXPENSE", icon: "📚", color: "#06B6D4", isDefault: false },
    { name: "Household", type: "EXPENSE", icon: "🏠", color: "#84CC16", isDefault: false },
    { name: "Clothing", type: "EXPENSE", icon: "👕", color: "#A855F7", isDefault: false },
    { name: "Beauty", type: "EXPENSE", icon: "💄", color: "#F472B6", isDefault: false },
    { name: "Technology", type: "EXPENSE", icon: "💻", color: "#3B82F6", isDefault: false },
    { name: "Sports & Fitness", type: "EXPENSE", icon: "⚽", color: "#22C55E", isDefault: false },
    { name: "Donation", type: "EXPENSE", icon: "🤲", color: "#10B981", isDefault: false },
  ];

  const categoryIds: Record<string, string> = {};
  for (const category of defaultCategories) {
    const created = await prisma.category.create({
      data: {
        userId: demoUser.id,
        name: category.name,
        type: category.type as "INCOME" | "EXPENSE",
        icon: category.icon,
        color: category.color,
        isDefault: category.isDefault,
      },
    });
    categoryIds[category.name] = created.id;
  }
  console.log(`✅ Created ${defaultCategories.length} categories\n`);

  // ============================================
  // 4. CREATE ACCOUNTS
  //    All start at 0; balances are computed
  //    by replaying every transaction below.
  //
  //    CREDIT CARD balance semantics (liability):
  //      positive value = debt owed to the bank
  //      0              = fully paid off
  // ============================================
  console.log("💳 Creating accounts...");

  const [cashAccount, bankAccount, ewalletAccount, creditAccount, savingsAccount, investmentAccount] = await Promise.all([
    prisma.account.create({
      data: { userId: demoUser.id, name: "Cash", type: "CASH", balance: 0, color: "#10B981", icon: "💵", isDefault: true },
    }),
    prisma.account.create({
      data: { userId: demoUser.id, name: "Bank Account", type: "BANK", balance: 0, color: "#3B82F6", icon: "🏦", isDefault: false },
    }),
    prisma.account.create({
      data: { userId: demoUser.id, name: "GoPay / OVO", type: "EWALLET", balance: 0, color: "#22C55E", icon: "📱", isDefault: false },
    }),
    prisma.account.create({
      data: {
        userId: demoUser.id,
        name: "Credit Card",
        type: "CREDIT_CARD",
        balance: 0, // starts fully paid off
        creditLimit: 15_000_000,
        color: "#EF4444",
        icon: "💳",
        isDefault: false,
      },
    }),
    prisma.account.create({
      data: { userId: demoUser.id, name: "Savings", type: "BANK", balance: 0, color: "#8B5CF6", icon: "🏛️", isDefault: false },
    }),
    prisma.account.create({
      data: { userId: demoUser.id, name: "Investment", type: "INVESTMENT", balance: 0, color: "#F59E0B", icon: "📈", isDefault: false },
    }),
  ]);

  const accounts = [cashAccount, bankAccount, ewalletAccount, creditAccount, savingsAccount, investmentAccount];
  console.log(`✅ Created ${accounts.length} accounts\n`);

  // ============================================
  // 5. BUILD TRANSACTION LIST
  // ============================================
  console.log("💰 Building transactions...");

  type TxType = "INCOME" | "EXPENSE" | "TRANSFER";

  interface TxRow {
    accountId: string;
    toAccountId?: string;
    categoryId?: string;
    amount: number;
    type: TxType;
    description: string;
    date: Date;
  }

  const transactions: TxRow[] = [];

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const randBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  const dateIn = (year: number, month: number, dayMin = 1, dayMax?: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const day = randBetween(dayMin, Math.min(dayMax ?? daysInMonth, daysInMonth));
    return new Date(year, month, day, randBetween(7, 22), randBetween(0, 59));
  };

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // ── 6-month loop ─────────────────────────────────────────────────────────

  for (let i = 5; i >= 0; i--) {
    const rawMonth = currentMonth - i;
    const year = rawMonth < 0 ? currentYear - 1 : currentYear;
    const month = rawMonth < 0 ? rawMonth + 12 : rawMonth;
    const isThisMonth = i === 0;

    // ── INCOME ──────────────────────────────────────────────────────────

    // Salary — always on the 25th, paid to bank
    transactions.push({
      accountId: bankAccount.id,
      categoryId: categoryIds["Salary"],
      amount: 12_500_000,
      type: "INCOME",
      description: "Monthly Salary",
      date: new Date(year, month, 25, 9, 0),
    });

    // Bonus — months 0 and 3 of the 6-month window
    if (i === 5 || i === 2) {
      transactions.push({
        accountId: bankAccount.id,
        categoryId: categoryIds["Bonus"],
        amount: 5_000_000,
        type: "INCOME",
        description: "Performance Bonus",
        date: dateIn(year, month),
      });
    }

    // Freelance — every month
    transactions.push({
      accountId: bankAccount.id,
      categoryId: categoryIds["Freelance"],
      amount: randBetween(1_500_000, 4_500_000),
      type: "INCOME",
      description: getRandom(["Website Project", "Consulting Work", "Design Project", "App Development", "Content Writing"]),
      date: dateIn(year, month),
    });

    // Investment return — every 2 months, goes to investment account
    if (i % 2 === 0) {
      transactions.push({
        accountId: investmentAccount.id,
        categoryId: categoryIds["Investment"],
        amount: randBetween(400_000, 1_200_000),
        type: "INCOME",
        description: getRandom(["Dividend", "Stock Return", "Mutual Fund Return", "Bond Interest"]),
        date: dateIn(year, month),
      });
    }

    // Gift — random months
    if (Math.random() > 0.6) {
      transactions.push({
        accountId: cashAccount.id,
        categoryId: categoryIds["Gift"],
        amount: randBetween(200_000, 1_000_000),
        type: "INCOME",
        description: getRandom(["Birthday Gift", "Holiday Gift", "Cash Gift"]),
        date: dateIn(year, month),
      });
    }

    // ── EXPENSE ─────────────────────────────────────────────────────────
    //
    // NOTE on credit card expenses:
    //   The credit card is used for shopping and tech purchases.
    //   Each EXPENSE on the credit card INCREASES its balance (debt).
    //   Credit card payments are modelled as TRANSFER bank → credit card
    //   which DECREASES the balance (debt).

    // Food & Drinks — ~20 per month, cash or e-wallet only (not CC)
    for (let j = 0; j < 20; j++) {
      transactions.push({
        accountId: getRandom([cashAccount.id, ewalletAccount.id]),
        categoryId: categoryIds["Food & Drinks"],
        amount: randBetween(20_000, 120_000),
        type: "EXPENSE",
        description: getRandom(["Breakfast", "Lunch", "Dinner", "Coffee", "Snacks", "Restaurant", "Fast Food", "Groceries", "Bubble Tea", "Bakery"]),
        date: dateIn(year, month),
      });
    }

    // Transportation — 15 per month, cash or e-wallet
    for (let j = 0; j < 15; j++) {
      transactions.push({
        accountId: getRandom([cashAccount.id, ewalletAccount.id]),
        categoryId: categoryIds["Transportation"],
        amount: randBetween(15_000, 80_000),
        type: "EXPENSE",
        description: getRandom(["Grab", "Gojek", "Gas", "Parking", "Toll", "Bus", "Train", "Commuter Line"]),
        date: dateIn(year, month),
      });
    }

    // Bills & Utilities — fixed days, paid from bank
    transactions.push(
      {
        accountId: bankAccount.id,
        categoryId: categoryIds["Bills & Utilities"],
        amount: randBetween(350_000, 500_000),
        type: "EXPENSE",
        description: "Electricity Bill",
        date: new Date(year, month, 5),
      },
      { accountId: bankAccount.id, categoryId: categoryIds["Bills & Utilities"], amount: 450_000, type: "EXPENSE", description: "Internet Bill", date: new Date(year, month, 10) },
      { accountId: bankAccount.id, categoryId: categoryIds["Bills & Utilities"], amount: 165_000, type: "EXPENSE", description: "Netflix + Spotify", date: new Date(year, month, 15) },
      { accountId: bankAccount.id, categoryId: categoryIds["Bills & Utilities"], amount: 75_000, type: "EXPENSE", description: "Phone Plan", date: new Date(year, month, 20) },
    );

    // Shopping — 3–5 per month, e-wallet or CREDIT CARD (raises CC debt)
    const shopCount = randBetween(3, 5);
    for (let j = 0; j < shopCount; j++) {
      transactions.push({
        accountId: getRandom([ewalletAccount.id, creditAccount.id]),
        categoryId: categoryIds["Shopping"],
        amount: randBetween(100_000, 600_000),
        type: "EXPENSE",
        description: getRandom(["Groceries", "Household Items", "Personal Care", "Online Shopping", "Books", "Stationery"]),
        date: dateIn(year, month),
      });
    }

    // Entertainment — 1–3 per month, cash or e-wallet
    const entCount = randBetween(1, 3);
    for (let j = 0; j < entCount; j++) {
      transactions.push({
        accountId: getRandom([cashAccount.id, ewalletAccount.id]),
        categoryId: categoryIds["Entertainment"],
        amount: randBetween(50_000, 350_000),
        type: "EXPENSE",
        description: getRandom(["Cinema", "Concert", "Games", "Karaoke", "Bowling", "Theme Park", "Museum"]),
        date: dateIn(year, month),
      });
    }

    // Healthcare — occasional
    if (Math.random() > 0.5) {
      transactions.push({
        accountId: getRandom([cashAccount.id, bankAccount.id]),
        categoryId: categoryIds["Healthcare"],
        amount: randBetween(100_000, 600_000),
        type: "EXPENSE",
        description: getRandom(["Doctor Visit", "Medicine", "Dental", "Eye Care", "Health Supplements", "Lab Test"]),
        date: dateIn(year, month),
      });
    }

    // Clothing — occasional, e-wallet or CREDIT CARD
    if (Math.random() > 0.6) {
      transactions.push({
        accountId: getRandom([ewalletAccount.id, creditAccount.id]),
        categoryId: categoryIds["Clothing"],
        amount: randBetween(150_000, 500_000),
        type: "EXPENSE",
        description: getRandom(["Shirts", "Pants", "Shoes", "Accessories", "Jacket", "Sneakers"]),
        date: dateIn(year, month),
      });
    }

    // Technology — bigger, rare, on CREDIT CARD
    if (Math.random() > 0.75) {
      transactions.push({
        accountId: creditAccount.id,
        categoryId: categoryIds["Technology"],
        amount: randBetween(300_000, 2_000_000),
        type: "EXPENSE",
        description: getRandom(["Phone Accessories", "Software License", "Gaming", "Smart Watch", "Headphones"]),
        date: dateIn(year, month),
      });
    }

    // Sports & Fitness — gym, always from bank
    transactions.push({
      accountId: bankAccount.id,
      categoryId: categoryIds["Sports & Fitness"],
      amount: 750_000,
      type: "EXPENSE",
      description: "Gym Membership",
      date: new Date(year, month, 1),
    });

    // Beauty — occasional
    if (Math.random() > 0.65) {
      transactions.push({
        accountId: getRandom([cashAccount.id, ewalletAccount.id]),
        categoryId: categoryIds["Beauty"],
        amount: randBetween(80_000, 400_000),
        type: "EXPENSE",
        description: getRandom(["Haircut", "Skincare", "Salon", "Spa", "Cosmetics"]),
        date: dateIn(year, month),
      });
    }

    // Donation — occasional
    if (Math.random() > 0.7) {
      transactions.push({
        accountId: getRandom([cashAccount.id, ewalletAccount.id]),
        categoryId: categoryIds["Donation"],
        amount: randBetween(50_000, 300_000),
        type: "EXPENSE",
        description: getRandom(["Charity", "Mosque Donation", "Social Fund", "Zakat", "Community Help"]),
        date: dateIn(year, month),
      });
    }

    // Education — occasional
    if (Math.random() > 0.7) {
      transactions.push({
        accountId: bankAccount.id,
        categoryId: categoryIds["Education"],
        amount: randBetween(100_000, 800_000),
        type: "EXPENSE",
        description: getRandom(["Online Course", "Book Purchase", "Workshop", "Seminar", "Training"]),
        date: dateIn(year, month),
      });
    }

    // Household — monthly supplies
    transactions.push({
      accountId: getRandom([cashAccount.id, ewalletAccount.id]),
      categoryId: categoryIds["Household"],
      amount: randBetween(100_000, 400_000),
      type: "EXPENSE",
      description: getRandom(["Cleaning Supplies", "Home Decor", "Kitchen Items", "Laundry", "Maintenance"]),
      date: dateIn(year, month),
    });

    // ── TRANSFERS ────────────────────────────────────────────────────────

    // Top-up e-wallet from bank (3–4 per month)
    const topUpCount = randBetween(3, 4);
    for (let j = 0; j < topUpCount; j++) {
      transactions.push({
        accountId: bankAccount.id,
        toAccountId: ewalletAccount.id,
        amount: randBetween(200_000, 500_000),
        type: "TRANSFER",
        description: "Top Up GoPay / OVO",
        date: dateIn(year, month),
      });
    }

    // Monthly savings transfer (bank → savings, day after salary)
    transactions.push({
      accountId: bankAccount.id,
      toAccountId: savingsAccount.id,
      amount: randBetween(2_000_000, 4_000_000),
      type: "TRANSFER",
      description: "Monthly Savings Transfer",
      date: new Date(year, month, 26, 10, 0),
    });

    // Monthly investment top-up (bank → investment)
    transactions.push({
      accountId: bankAccount.id,
      toAccountId: investmentAccount.id,
      amount: randBetween(500_000, 2_000_000),
      type: "TRANSFER",
      description: "Investment Top-Up",
      date: new Date(year, month, 27, 10, 0),
    });

    // ATM cash withdrawal (bank → no destination = pure outflow from bank)
    transactions.push({
      accountId: bankAccount.id,
      amount: randBetween(500_000, 1_500_000),
      type: "TRANSFER",
      description: "ATM Cash Withdrawal",
      date: dateIn(year, month),
    });

    // Credit card payment: TRANSFER bank → credit card
    //   This REDUCES credit card debt (destination is CC → balance -=)
    //   Only include if past the 15th of the current month (realistic)
    if (!isThisMonth || now.getDate() >= 15) {
      transactions.push({
        accountId: bankAccount.id,
        toAccountId: creditAccount.id,
        amount: randBetween(1_000_000, 3_000_000),
        type: "TRANSFER",
        description: "Credit Card Payment",
        date: dateIn(year, month, 14, 20),
      });
    }
  }

  // ============================================
  // 6. INSERT TRANSACTIONS & COMPUTE BALANCES
  //
  //    All accounts use the same arithmetic:
  //      INCOME            → balance += amount
  //      EXPENSE           → balance -= amount
  //      TRANSFER (source) → balance -= amount
  //      TRANSFER (dest)   → balance += amount
  //
  //    Credit card starts at 0 (fully paid off).
  //    Every EXPENSE or cash-advance TRANSFER makes it more negative.
  //    Every payment TRANSFER makes it less negative (toward 0).
  //    Final balance is negative = amount of debt owed.
  // ============================================
  console.log("💾 Inserting transactions & computing balances...");

  transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

  // accountType lookup so we can apply the right balance rule
  const accountTypeMap: Record<string, string> = {};
  for (const acc of accounts) {
    accountTypeMap[acc.id] = acc.type;
  }

  const balances: Record<string, number> = {};
  for (const acc of accounts) balances[acc.id] = 0;

  let txCreated = 0;

  for (const tx of transactions) {
    await prisma.transaction.create({
      data: {
        userId: demoUser.id,
        accountId: tx.accountId,
        toAccountId: tx.toAccountId ?? null,
        categoryId: tx.categoryId ?? null,
        amount: tx.amount,
        type: tx.type,
        description: tx.description,
        date: tx.date,
      },
    });

    const sourceIsCreditCard = accountTypeMap[tx.accountId] === "CREDIT_CARD";
    const destIsCreditCard = tx.toAccountId ? accountTypeMap[tx.toAccountId] === "CREDIT_CARD" : false;

    if (tx.type === "TRANSFER") {
      // Source
      if (sourceIsCreditCard) {
        // Cash advance: debt increases → balance goes more negative
        balances[tx.accountId] -= tx.amount;
      } else {
        balances[tx.accountId] -= tx.amount; // money leaves normal account
      }
      // Destination
      if (tx.toAccountId) {
        if (destIsCreditCard) {
          // Payment: debt decreases → balance goes less negative (toward 0)
          balances[tx.toAccountId] += tx.amount;
        } else {
          balances[tx.toAccountId] += tx.amount; // money arrives at normal account
        }
      }
    } else if (tx.type === "INCOME") {
      if (sourceIsCreditCard) {
        // Not used in seed, but defensive: income on CC reduces debt
        balances[tx.accountId] += tx.amount;
      } else {
        balances[tx.accountId] += tx.amount;
      }
    } else {
      // EXPENSE
      if (sourceIsCreditCard) {
        // Spending on CC increases debt → balance goes more negative
        balances[tx.accountId] -= tx.amount;
      } else {
        balances[tx.accountId] -= tx.amount;
      }
    }

    txCreated++;
  }

  // Write computed balances back to accounts
  for (const [accountId, balance] of Object.entries(balances)) {
    await prisma.account.update({
      where: { id: accountId },
      data: { balance },
    });
  }

  console.log(`✅ Created ${txCreated} transactions\n`);
  console.log("💰 Final account balances:");
  for (const acc of accounts) {
    const bal = balances[acc.id];
    if (acc.type === "CREDIT_CARD") {
      // Balance is stored as negative; show absolute value as debt
      console.log(`   ${acc.icon} ${acc.name.padEnd(16)} Debt: Rp ${Math.abs(bal).toLocaleString("id-ID")} (limit: Rp 15,000,000)`);
    } else {
      const sign = bal >= 0 ? "" : "-";
      console.log(`   ${acc.icon} ${acc.name.padEnd(16)} Rp ${sign}${Math.abs(bal).toLocaleString("id-ID")}`);
    }
  }
  console.log();

  // ============================================
  // 7. CREATE BUDGETS (current month, real spent)
  // ============================================
  console.log("📊 Creating budgets...");

  const budgetDefs = [
    { name: "Food & Drinks", amount: 3_000_000 },
    { name: "Transportation", amount: 1_500_000 },
    { name: "Shopping", amount: 2_000_000 },
    { name: "Entertainment", amount: 800_000 },
    { name: "Bills & Utilities", amount: 1_500_000 },
    { name: "Healthcare", amount: 1_000_000 },
    { name: "Clothing", amount: 1_000_000 },
    { name: "Sports & Fitness", amount: 1_000_000 },
    { name: "Beauty", amount: 500_000 },
    { name: "Household", amount: 600_000 },
  ];

  for (const def of budgetDefs) {
    const categoryId = categoryIds[def.name];

    const { _sum } = await prisma.transaction.aggregate({
      where: {
        userId: demoUser.id,
        categoryId,
        type: "EXPENSE",
        date: {
          gte: new Date(currentYear, currentMonth, 1),
          lte: new Date(currentYear, currentMonth + 1, 0),
        },
      },
      _sum: { amount: true },
    });

    await prisma.budget.create({
      data: {
        userId: demoUser.id,
        categoryId,
        amount: def.amount,
        spent: _sum.amount ?? 0,
        month: currentMonth + 1,
        year: currentYear,
      },
    });
  }

  console.log(`✅ Created ${budgetDefs.length} budgets\n`);

  // ============================================
  // 8. CREATE FINANCIAL GOALS
  // ============================================
  console.log("🎯 Creating financial goals...");

  const totalSaved = balances[savingsAccount.id];

  await Promise.all([
    prisma.goal.create({
      data: {
        userId: demoUser.id,
        name: "Emergency Fund",
        targetAmount: 50_000_000,
        currentAmount: Math.min(totalSaved, 35_000_000),
        deadline: new Date(currentYear, currentMonth + 6, 30),
        status: "ACTIVE",
      },
    }),
    prisma.goal.create({
      data: {
        userId: demoUser.id,
        name: "New Laptop",
        targetAmount: 25_000_000,
        currentAmount: 18_500_000,
        deadline: new Date(currentYear, currentMonth + 3, 30),
        status: "ACTIVE",
      },
    }),
    prisma.goal.create({
      data: {
        userId: demoUser.id,
        name: "Vacation Fund",
        targetAmount: 15_000_000,
        currentAmount: 8_200_000,
        deadline: new Date(currentYear, currentMonth + 8, 30),
        status: "ACTIVE",
      },
    }),
    prisma.goal.create({
      data: {
        userId: demoUser.id,
        name: "Investment Portfolio",
        targetAmount: 100_000_000,
        currentAmount: balances[investmentAccount.id],
        deadline: new Date(currentYear + 1, 11, 31),
        status: "ACTIVE",
      },
    }),
    prisma.goal.create({
      data: {
        userId: demoUser.id,
        name: "House Down Payment",
        targetAmount: 200_000_000,
        currentAmount: 25_000_000,
        deadline: new Date(currentYear + 3, 11, 31),
        status: "ACTIVE",
      },
    }),
  ]);

  console.log("✅ Created 5 financial goals\n");

  // ============================================
  // 9. CREATE RECURRING TRANSACTIONS
  // ============================================
  console.log("🔄 Creating recurring transactions...");

  await Promise.all([
    prisma.recurringTransaction.create({
      data: {
        userId: demoUser.id,
        accountId: bankAccount.id,
        categoryId: categoryIds["Salary"],
        amount: 12_500_000,
        type: "INCOME",
        description: "Monthly Salary",
        frequency: "MONTHLY",
        startDate: new Date(currentYear, 0, 25),
        nextOccurrence: new Date(currentYear, currentMonth + 1, 25),
        isActive: true,
      },
    }),
    prisma.recurringTransaction.create({
      data: {
        userId: demoUser.id,
        accountId: bankAccount.id,
        categoryId: categoryIds["Bills & Utilities"],
        amount: 400_000,
        type: "EXPENSE",
        description: "Electricity Bill",
        frequency: "MONTHLY",
        startDate: new Date(currentYear, 0, 5),
        nextOccurrence: new Date(currentYear, currentMonth + 1, 5),
        isActive: true,
      },
    }),
    prisma.recurringTransaction.create({
      data: {
        userId: demoUser.id,
        accountId: bankAccount.id,
        categoryId: categoryIds["Bills & Utilities"],
        amount: 450_000,
        type: "EXPENSE",
        description: "Internet Bill",
        frequency: "MONTHLY",
        startDate: new Date(currentYear, 0, 10),
        nextOccurrence: new Date(currentYear, currentMonth + 1, 10),
        isActive: true,
      },
    }),
    prisma.recurringTransaction.create({
      data: {
        userId: demoUser.id,
        accountId: bankAccount.id,
        categoryId: categoryIds["Sports & Fitness"],
        amount: 750_000,
        type: "EXPENSE",
        description: "Gym Membership",
        frequency: "MONTHLY",
        startDate: new Date(currentYear, 0, 1),
        nextOccurrence: new Date(currentYear, currentMonth + 1, 1),
        isActive: true,
      },
    }),
    prisma.recurringTransaction.create({
      data: {
        userId: demoUser.id,
        accountId: bankAccount.id,
        categoryId: categoryIds["Bills & Utilities"],
        amount: 165_000,
        type: "EXPENSE",
        description: "Netflix + Spotify",
        frequency: "MONTHLY",
        startDate: new Date(currentYear, 0, 15),
        nextOccurrence: new Date(currentYear, currentMonth + 1, 15),
        isActive: true,
      },
    }),
    prisma.recurringTransaction.create({
      data: {
        userId: demoUser.id,
        accountId: ewalletAccount.id,
        categoryId: categoryIds["Food & Drinks"],
        amount: 500_000,
        type: "EXPENSE",
        description: "Weekly Groceries",
        frequency: "WEEKLY",
        startDate: new Date(currentYear, 0, 1),
        nextOccurrence: new Date(currentYear, currentMonth + 1, 7),
        isActive: true,
      },
    }),
    // Monthly savings transfer (recurring)
    prisma.recurringTransaction.create({
      data: {
        userId: demoUser.id,
        accountId: bankAccount.id,
        categoryId: categoryIds["Salary"], // closest category proxy
        amount: 3_000_000,
        type: "INCOME", // RecurringTransaction requires a category; we reuse Salary as a placeholder
        description: "Monthly Savings Transfer",
        frequency: "MONTHLY",
        startDate: new Date(currentYear, 0, 26),
        nextOccurrence: new Date(currentYear, currentMonth + 1, 26),
        isActive: true,
      },
    }),
  ]);

  console.log("✅ Created 7 recurring transactions\n");

  // ============================================
  // 10. APP SETTINGS
  // ============================================
  const APP_SETTINGS = [
    // options settings
    { key: "currency_options", value: JSON.stringify(CURRENCY_OPTIONS), type: "json", category: "appearance", label: "Currency Options", description: "Available currency options", isPublic: true },
    { key: "language_options", value: JSON.stringify(LANGUAGE_OPTIONS), type: "json", category: "appearance", label: "Language Options", description: "Available language options", isPublic: true },
    { key: "theme_options", value: JSON.stringify(THEME_OPTIONS), type: "json", category: "appearance", label: "Theme Options", description: "Available theme options", isPublic: true },

    // currencies settings
    {
      key: "currency_locale_map",
      value: JSON.stringify(CURRENCY_LOCALE_MAP),
      type: "json",
      category: "currencies",
      label: "Currency Locale Map",
      description: "Mapping of currency to locale",
      isPublic: true,
    },
    {
      key: "zero_decimal_currencies",
      value: JSON.stringify(ZERO_DECIMAL_CURRENCIES),
      type: "json",
      category: "currencies",
      label: "Zero Decimal Currencies",
      description: "Currencies without decimal fractions",
      isPublic: true,
    },

    // feature settings
    { key: "allow_registration", value: "true", type: "boolean", category: "features", label: "Allow Registration", description: "Allow new users to register", isPublic: false },
    { key: "maintenance_mode", value: "false", type: "boolean", category: "features", label: "Maintenance Mode", description: "Put app in maintenance mode", isPublic: false },

    // limits settings
    { key: "max_accounts_per_user", value: "10", type: "number", category: "limits", label: "Max Accounts Per User", description: "Maximum accounts a user can create", isPublic: false },
    { key: "max_categories_per_user", value: "50", type: "number", category: "limits", label: "Max Categories Per User", description: "Maximum custom categories per user", isPublic: false },

    // informational settings
    { key: "app_version", value: "1.6.3", type: "string", category: "app_information", label: "App Version", description: "Current application version", isPublic: true },
    { key: "app_created", value: "January 1, 2026", type: "string", category: "app_information", label: "Created", description: "Application creation date", isPublic: true },
    { key: "app_build_number", value: "2026.06.06", type: "string", category: "app_information", label: "Build Number", description: "Current application build number", isPublic: true },
    { key: "app_environment", value: "Production", type: "string", category: "app_information", label: "Environment", description: "Current application environment", isPublic: true },
    { key: "home_title", value: "Finarthax", type: "string", category: "general_information", label: "Home Title", description: "Main title on homepage", isPublic: true },
    { key: "how_it_works_title", value: "How it works:", type: "string", category: "general_information", label: "How It Works Title", description: "How it works section title", isPublic: true },
    { key: "ready_for_more_title", value: "Ready for More?", type: "string", category: "general_information", label: "Ready For More Title", description: "Marketing section title", isPublic: true },
    {
      key: "ready_for_more_description",
      value: "Create a free account to sync your data, set budgets, and access powerful analytics",
      type: "string",
      category: "general_information",
      label: "Ready For More Description",
      description: "Marketing section description",
      isPublic: true,
    },
    {
      key: "footer_copyright",
      value: "© 2026 Finarthax. All rights reserved.",
      type: "string",
      category: "general_information",
      label: "Footer Copyright",
      description: "Copyright text displayed in the website footer",
      isPublic: true,
    },
    {
      key: "home_subtitle",
      value: "Record your transactions instantly, no login required",
      type: "string",
      category: "general_information",
      label: "Home Subtitle",
      description: "Homepage subtitle",
      isPublic: true,
    },
    {
      key: "how_it_works_content",
      value: JSON.stringify([
        "Record transactions without creating an account",
        "Transactions saved locally on your device",
        "Perfect for quick expense tracking on the go",
        "Sign up later to sync and access advanced features",
      ]),
      type: "json",
      category: "general_information",
      label: "How It Works Content",
      description: "How it works section bullet points",
      isPublic: true,
    },
  ] as const;

  for (const setting of APP_SETTINGS) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: { ...setting },
    });
  }

  console.log(`✅ ${APP_SETTINGS.length} app settings seeded\n`);

  // ============================================
  // SUMMARY
  // ============================================
  const totalIncome = transactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const totalTransfer = transactions.filter((t) => t.type === "TRANSFER").reduce((s, t) => s + t.amount, 0);

  // Net worth: assets (positive balances) minus credit card debt (stored negative)
  const netWorth = Object.values(balances).reduce((sum, bal) => {
    // Credit card balance is negative, so adding it directly subtracts from net worth
    return sum + bal;
  }, 0);

  console.log("═══════════════════════════════════════════════");
  console.log("🎉  DATABASE SEEDING COMPLETED!");
  console.log("═══════════════════════════════════════════════\n");
  console.log("📦 Summary:");
  console.log(`   • ${defaultCategories.length} categories`);
  console.log(`   • 1 demo user`);
  console.log(`   • ${accounts.length} accounts`);
  console.log(`   • ${txCreated} transactions (income + expense + transfer)`);
  console.log(`   • ${budgetDefs.length} budgets`);
  console.log(`   • 5 goals`);
  console.log(`   • 7 recurring transactions\n`);

  console.log("🔐 Credentials:");
  console.log("   Email:    demo@finance.com");
  console.log("   Password: password123\n");

  console.log("📊 6-Month Financial Summary:");
  console.log(`   • Total Income:    Rp ${totalIncome.toLocaleString("id-ID")}`);
  console.log(`   • Total Expense:   Rp ${totalExpense.toLocaleString("id-ID")}`);
  console.log(`   • Total Transfers: Rp ${totalTransfer.toLocaleString("id-ID")}`);
  console.log(`   • Net Savings:     Rp ${(totalIncome - totalExpense).toLocaleString("id-ID")}`);
  console.log(`   • Net Worth:       Rp ${netWorth.toLocaleString("id-ID")}\n`);

  console.log("💰 Per-Account Balances:");
  for (const acc of accounts) {
    const bal = balances[acc.id];
    if (acc.type === "CREDIT_CARD") {
      console.log(`   ${acc.icon} ${acc.name.padEnd(16)} Debt: Rp ${bal.toLocaleString("id-ID")} (limit: Rp 15,000,000)`);
    } else {
      const sign = bal >= 0 ? "" : "-";
      console.log(`   ${acc.icon} ${acc.name.padEnd(16)} Rp ${sign}${Math.abs(bal).toLocaleString("id-ID")}`);
    }
  }
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
