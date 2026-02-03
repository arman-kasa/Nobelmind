import { ethers } from "ethers";

/**
 * این تابع مسئول تبدیل ایمن مبالغ اعشاری به فرمت قابل قبول بلاکچین است.
 * مشکل اصلی شما ارسال اعداد اعشاری طولانی (مثل 1.05263...) بود.
 * این تابع به طور خودکار اعشار اضافه را حذف می‌کند.
 */
export const toWeiSafe = (amount: number | string, decimals: number = 6): bigint => {
  try {
    // 1. تبدیل ورودی به رشته
    let amountStr = amount.toString();

    // 2. پیدا کردن محل نقطه اعشار
    const dotIndex = amountStr.indexOf(".");

    if (dotIndex > -1) {
      // 3. اگر تعداد ارقام اعشار بیشتر از حد مجاز توکن باشد، آن را برش می‌دهیم (Truncate)
      // مثلا اگر decimals=6 باشد و عدد 1.05263157... باشد، تبدیل می‌شود به 1.052631
      const decimalsLength = amountStr.length - (dotIndex + 1);
      if (decimalsLength > decimals) {
        amountStr = amountStr.substring(0, dotIndex + 1 + decimals);
      }
    }

    // 4. تبدیل نهایی به فرمت BigInt برای ارسال به قرارداد
    return ethers.parseUnits(amountStr, decimals);
  } catch (error) {
    console.error("Error converting to wei:", error);
    throw new Error("Invalid amount format");
  }
};

/**
 * تبدیل معکوس برای نمایش به کاربر (از بلاکچین به عدد معمولی)
 */
export const fromWeiSafe = (amount: bigint | string, decimals: number = 6): string => {
  try {
    return ethers.formatUnits(amount, decimals);
  } catch (error) {
    return "0";
  }
};