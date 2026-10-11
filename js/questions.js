/**
 * questions.js - 數學單元題庫系統（因數與倍數）
 * 涵蓋 Bloom 認知層次：知識、理解、應用、分析
 * 支援 CSV/JSON 動態解析與自訂擴充
 */

const QuestionBank = {
  // 預設標準題庫
  defaultQuestions: [
    // ======== Level 1: 基礎暖身（因數與倍數辨析） ========
    {
      id: 1,
      level: 1,
      bloom: "記憶/理解",
      category: "因數概念",
      prompt: "【因數識別】下列哪一個數是 24 的因數？",
      shortTarget: "24 的因數",
      options: ["7", "9", "8", "14"],
      answer: "8",
      explanation: "24 ÷ 8 = 3，可以整除且無餘數，因此 8 是 24 的因數。",
      hint: "🎯 戰術提示：能把 24 整除的數就是因數！因數一定小於或等於 24。口訣：『因數小或等，整除不留餘』"
    },
    {
      id: 2,
      level: 1,
      bloom: "記憶/理解",
      category: "倍數概念",
      prompt: "【倍數識別】下列哪一個數是 7 的倍數？",
      shortTarget: "7 的倍數",
      options: ["27", "35", "43", "50"],
      answer: "35",
      explanation: "7 × 5 = 35，因此 35 是 7 的倍數。",
      hint: "🎯 戰術提示：7 的倍數就是 7 的乘法表中的數字（7×1, 7×2...）。口訣：『倍數大或等，無限放大去』"
    },
    {
      id: 3,
      level: 1,
      bloom: "理解/分析",
      category: "因數判斷",
      prompt: "【因數排查】哪一個數字「不是」36 的因數？",
      shortTarget: "非 36 的因數",
      options: ["4", "6", "8", "9"],
      answer: "8",
      explanation: "36 ÷ 8 = 4 餘 4，無法整除，所以 8 不是 36 的因數。",
      hint: "🎯 戰術提示：拿 36 去除以選項，檢查有沒有餘數。36 ÷ 4 = 9, 36 ÷ 6 = 6, 36 ÷ 9 = 4 都能整除！"
    },
    {
      id: 4,
      level: 1,
      bloom: "應用",
      category: "倍數範圍",
      prompt: "【倍數偵測】在 1 到 100 之間，最接近 100 的 15 的倍數是？",
      shortTarget: "接近 100 的 15 倍數",
      options: ["90", "95", "105", "75"],
      answer: "90",
      explanation: "15 × 6 = 90，15 × 7 = 105（已超過100），因此 90 是最接近且不大於 100 的倍數。",
      hint: "🎯 戰術提示：15的倍數有 15, 30, 45, 60, 75, 90, 105... 注意題目限制在 100 以內！"
    },
    {
      id: 5,
      level: 1,
      bloom: "理解/辨析",
      category: "核心概念",
      prompt: "【概念辨析】下列關於「因數與倍數」的觀念，何者正確？",
      shortTarget: "正確概念",
      options: [
        "一個正整數的最小正倍數是它自己",
        "任何整數的最大因數是無限大",
        "因數一定比倍數大",
        "0 是所有整數的因數"
      ],
      answer: "一個正整數的最小正倍數是它自己",
      explanation: "任何正整數乘以 1 等於自己，因此正倍數中最小的是自己；因數是有限的，最大因數是自己。",
      hint: "🎯 戰術提示：牢記黃金口訣——『因數小或等，倍數大或等』！0 不能當除數，也不是因數。"
    },
    {
      id: 6,
      level: 1,
      bloom: "應用",
      category: "因數總數",
      prompt: "【因數清查】整數 18 的所有正因數總共有幾個？",
      shortTarget: "18 的因數總數",
      options: ["4", "6", "8", "5"],
      answer: "6",
      explanation: "18 的因數配對：1×18, 2×9, 3×6。因數為 1, 2, 3, 6, 9, 18，共有 6 個。",
      hint: "🎯 戰術提示：使用「彩虹乘法配對法」：1×18, 2×9, 3×6，數一數共有 6 個數字！"
    },

    // ======== Level 2: 進階應用（最小公倍數與最大公因數 - 3D殭屍防守） ========
    {
      id: 9,
      level: 2,
      bloom: "應用/分析",
      category: "最小公倍數",
      prompt: "【特戰警報】25 和 30 的最小公倍數是多少？",
      targetNumbers: [25, 30],
      calcType: "LCM",
      options: ["5", "150", "750", "60"],
      answer: "150",
      explanation: "25 = 5×5，30 = 2×3×5。最小公倍數 [25, 30] = 2 × 3 × 5 × 5 = 150。（注意：5 是最大公因數！）",
      hint: "🎯 戰術提示：千萬不要把「最大公因數」和「最小公倍數」搞混！5 是因數（縮小），150 才是倍數（放大）。"
    },
    {
      id: 10,
      level: 2,
      bloom: "應用",
      category: "最大公因數",
      prompt: "【防線鎖定】18 和 24 的最大公因數是多少？",
      targetNumbers: [18, 24],
      calcType: "GCD",
      options: ["3", "6", "72", "12"],
      answer: "6",
      explanation: "18 的因數有 1,2,3,6,9,18；24 的因數有 1,2,3,4,6,8,12,24。共同擁有的最大公因數是 6。（72 是最小公倍數）",
      hint: "🎯 戰術提示：找最大公因數要平分縮小！短除法：18與24同除以 6，得到 3 與 4 (互質)，所以最大公因數是 6。"
    },
    {
      id: 11,
      level: 2,
      bloom: "應用",
      category: "最小公倍數",
      prompt: "【急速反應】8 和 12 的最小公倍數是多少？",
      targetNumbers: [8, 12],
      calcType: "LCM",
      options: ["4", "24", "48", "96"],
      answer: "24",
      explanation: "8 的倍數：8, 16, 24, 32...；12 的倍數：12, 24, 36...。共同的最小倍數是 24。（4 是最大公因數）",
      hint: "🎯 戰術提示：4 是最大公因數！題目問的是「最小公倍數」，數字會比 8 和 12 都大，且是共同擁有的最小倍數 24。"
    },
    {
      id: 12,
      level: 2,
      bloom: "理解/分析",
      category: "互質關係",
      prompt: "【戰術概念】若甲數與乙數「互質」，則它們的最大公因數是多少？",
      targetNumbers: [0, 0],
      calcType: "GCD",
      options: ["0", "1", "甲×乙", "沒有公因數"],
      answer: "1",
      explanation: "「互質」的定義就是兩數除了 1 之外沒有其他公因數，因此最大公因數必定是 1。",
      hint: "🎯 戰術提示：例如 8 和 9 互質，它們只有公因數 1。所以 (8, 9) = 1。"
    },
    {
      id: 13,
      level: 2,
      bloom: "應用",
      category: "最大公因數",
      prompt: "【重裝狙擊】36 和 48 的最大公因數是多少？",
      targetNumbers: [36, 48],
      calcType: "GCD",
      options: ["6", "12", "144", "18"],
      answer: "12",
      explanation: "36 = 12 × 3，48 = 12 × 4。短除法先除 2、再除 2、再除 3，公因數為 2×2×3 = 12。（144 是最小公倍數）",
      hint: "🎯 戰術提示：雖然 6 也是公因數，但題目要求「最大」公因數！36 與 48 都能被 12 整除。"
    },
    {
      id: 14,
      level: 2,
      bloom: "應用",
      category: "最小公倍數",
      prompt: "【火力全開】15 和 20 的最小公倍數是多少？",
      targetNumbers: [15, 20],
      calcType: "LCM",
      options: ["5", "30", "60", "300"],
      answer: "60",
      explanation: "15 = 3×5，20 = 4×5。最小公倍數 = 5 × 3 × 4 = 60。（5 是最大公因數，不是最小公倍數）",
      hint: "🎯 戰術提示：5 是最大公因數，千萬別選錯！15的倍數(15,30,45,60)，20的倍數(20,40,60)，第一個重合的是 60。"
    },

    // ======== Level 3: 綜合挑戰（情境生活應用 + 因倍數混合戰術） ========
    {
      id: 16,
      level: 3,
      bloom: "分析/綜合",
      category: "情境應用-公倍數",
      prompt: "【生活情境】小明每 6 天去一次圖書館，小華每 8 天去一次。今天兩人一起去，最少幾天後兩人會再次在圖書館相遇？",
      shortTarget: "相遇週期",
      options: ["2", "14", "24", "48"],
      answer: "24",
      explanation: "找週期重新重合的題目屬於「公倍數」問題。求 6 和 8 的最小公倍數 [6, 8] = 24 天。",
      hint: "🎯 情境判斷口訣：『同時出發再相遇、排程週期重疊』找【最小公倍數】！[6, 8] = 24。"
    },
    {
      id: 17,
      level: 3,
      bloom: "分析/綜合",
      category: "情境應用-公因數",
      prompt: "【生活情境】老師有 36 顆巧克力和 48 顆軟糖要平分給學生，每人分得一樣多且剛好分完，最多能分給幾位學生？",
      shortTarget: "平分人數上限",
      options: ["6", "12", "144", "84"],
      answer: "12",
      explanation: "物品平分、切分不浪費的問題屬於「公因數」問題。求 36 和 48 的最大公因數 (36, 48) = 12 人。",
      hint: "🎯 情境判斷口訣：『物品平分、分裝裁切不浪費』找【最大公因數】！(36, 48) = 12。"
    },
    {
      id: 18,
      level: 3,
      bloom: "分析/評價",
      category: "戰術決策判斷",
      prompt: "【戰術決策】「長 15 公分、寬 10 公分的長方形紙片，最少要幾張才能拼成一個正方形？」解題第一步必須求 15 和 10 的？",
      shortTarget: "解題策略決策",
      options: ["最小公倍數", "最大公因數", "總和", "差額"],
      answer: "最小公倍數",
      explanation: "拼成的大正方形邊長必須比 15 和 10 都大，且是它們的共同倍數，所以第一步是求最小公倍數（邊長為30公分）。",
      hint: "🎯 情境判斷口訣：小拼大、邊長延伸放大 ➡️ 找【最小公倍數】；大裁小、平分切割 ➡️ 找【最大公因數】！"
    },
    {
      id: 19,
      level: 3,
      bloom: "應用/綜合",
      category: "情境應用-公倍數",
      prompt: "【公車發車】A 公車每 12 分鐘發一班，B 公車每 15 分鐘發一班。早上 8:00 兩車同時出發，下一次同時發車是幾點幾分？",
      shortTarget: "班車同時出發",
      options: ["8:27", "8:30", "9:00", "8:45"],
      answer: "9:00",
      explanation: "求發車時間公倍數：[12, 15] = 60 分鐘。從早上 8:00 加上 60 分鐘（1小時），下一次同時發車為 9:00。",
      hint: "🎯 戰術提示：12 與 15 的最小公倍數是 60 分鐘！8:00 過 60 分鐘就是 9:00。"
    },
    {
      id: 20,
      level: 3,
      bloom: "分析/評價",
      category: "戰術決策判斷",
      prompt: "【裁切問題】「把一條長 90 公分與一條長 75 公分的木條，鋸成一樣長的短木條且沒有剩餘」，求短木條最長是幾公分？這是在求？",
      shortTarget: "裁切最長長度",
      options: ["最大公因數", "最小公倍數", "平均數", "質因數"],
      answer: "最大公因數",
      explanation: "將現有長度裁切成等長短木條，代表木條長度必須能整除 90 與 75，且要求最長，故求最大公因數 (90, 75) = 15 公分。",
      hint: "🎯 戰術提示：大鋸小、裁切平分 ➡️ 尋求【最大公因數】！"
    }
  ],

  /**
   * 取得指定關卡的題庫
   */
  getQuestions(level = 1) {
    const custom = this.loadCustomQuestions();
    const list = custom && custom.length > 0 ? custom : this.defaultQuestions;
    return list.filter(q => q.level === Number(level));
  },

  /**
   * 根據 ID 取得單一題目
   */
  getQuestionById(id) {
    const custom = this.loadCustomQuestions();
    const list = custom && custom.length > 0 ? custom : this.defaultQuestions;
    return list.find(q => q.id === Number(id));
  },

  /**
   * 從 LocalStorage 載入自訂題庫
   */
  loadCustomQuestions() {
    try {
      const saved = localStorage.getItem("valorant_math_custom_questions");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("無法載入自訂題庫:", e);
    }
    return null;
  },

  /**
   * 儲存自訂題庫
   */
  saveCustomQuestions(questions) {
    try {
      localStorage.setItem("valorant_math_custom_questions", JSON.stringify(questions));
      return true;
    } catch (e) {
      console.error("儲存題庫失敗:", e);
      return false;
    }
  },

  /**
   * 重設為預設題庫
   */
  resetToDefault() {
    localStorage.removeItem("valorant_math_custom_questions");
  },

  /**
   * 解析 CSV 字串為題目清單
   */
  parseCSV(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => h.trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // 支援包含雙引號逗號的 CSV 解析
      const row = this.parseCSVLine(line);
      if (row.length >= 7) {
        let options = [];
        try {
          if (row[4].startsWith("[")) {
            options = JSON.parse(row[4].replace(/'/g, '"'));
          } else {
            options = row[4].split("|").map(s => s.trim());
          }
        } catch {
          options = row[4].split(";").map(s => s.trim());
        }

        result.push({
          id: Number(row[0]) || i,
          level: Number(row[1]) || 1,
          bloom: "應用",
          category: row[2] || "綜合題",
          prompt: row[3] || "",
          shortTarget: row[3]?.slice(0, 15) || "",
          options: options,
          answer: String(row[5] || "").trim(),
          explanation: row[6] || "",
          hint: row[7] || "仔細檢查因數與倍數的定義與計算！"
        });
      }
    }
    return result;
  },

  /**
   * 簡易 CSV 行解析器（處理雙引號欄位）
   */
  parseCSVLine(line) {
    const values = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && (i === 0 || line[i - 1] !== "\\")) {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(cur.trim());
        cur = "";
      } else {
        cur += char;
      }
    }
    values.push(cur.trim());
    return values.map(v => v.replace(/^"|"$/g, "").replace(/""/g, '"'));
  }
};

// 暴露全域變數供瀏覽器腳本使用
if (typeof window !== "undefined") {
  window.QuestionBank = QuestionBank;
}
