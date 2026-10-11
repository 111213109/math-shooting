/**
 * teacher.js - 教師學習數據儀表板邏輯
 * 統計全班進度、高頻錯題排行榜、各關卡卡關分析與 CSV 匯出
 */

document.addEventListener("DOMContentLoaded", () => {
  const TeacherApp = {
    allStudents: {},
    currentClassFilter: "ALL",
    searchQuery: "",

    async init() {
      this.bindEvents();
      await this.refreshData();
    },

    bindEvents() {
      // 班級篩選切換
      const selectClass = document.getElementById("selectClassFilter");
      if (selectClass) {
        selectClass.addEventListener("change", (e) => {
          this.currentClassFilter = e.target.value;
          this.renderStudentsTable();
        });
      }

      // 搜尋欄
      const inputSearch = document.getElementById("inputSearchStudent");
      if (inputSearch) {
        inputSearch.addEventListener("input", (e) => {
          this.searchQuery = e.target.value.trim().toLowerCase();
          this.renderStudentsTable();
        });
      }

      // 匯出 CSV 按鈕
      const btnExport = document.getElementById("btnExportCSV");
      if (btnExport) {
        btnExport.addEventListener("click", () => this.handleExportCSV());
      }

      // 載入模擬數據按鈕
      const btnDemo = document.getElementById("btnGenerateDemo");
      if (btnDemo) {
        btnDemo.addEventListener("click", () => {
          window.StorageService.generateDemoData();
          alert("✅ 已成功載入模擬班級學習數據！");
          this.refreshData();
        });
      }

      // 清除數據按鈕
      const btnClear = document.getElementById("btnClearData");
      if (btnClear) {
        btnClear.addEventListener("click", () => {
          if (confirm("⚠️ 確定要清除所有學生數據嗎？此動作無法復原。")) {
            window.StorageService.clearAllData();
            this.refreshData();
          }
        });
      }

      // Firebase Modal
      const modal = document.getElementById("firebaseModal");
      const btnOpenFb = document.getElementById("btnOpenFirebaseModal");
      const btnCloseFb = document.getElementById("btnCloseFbModal");
      const btnSaveFb = document.getElementById("btnSaveFbConfig");
      const inputFbUrl = document.getElementById("inputFbUrl");
      const inputFbKey = document.getElementById("inputFbKey");

      if (btnOpenFb && modal) {
        btnOpenFb.addEventListener("click", () => {
          const cfg = window.StorageService.getFirebaseConfig();
          if (cfg) {
            inputFbUrl.value = cfg.databaseURL || "";
            inputFbKey.value = cfg.apiKey || "";
          }
          modal.classList.add("active");
        });
      }

      if (btnCloseFb && modal) {
        btnCloseFb.addEventListener("click", () => {
          modal.classList.remove("active");
        });
      }

      if (btnSaveFb && modal) {
        btnSaveFb.addEventListener("click", () => {
          const url = inputFbUrl.value.trim();
          const key = inputFbKey.value.trim();
          if (url) {
            window.StorageService.saveFirebaseConfig({ databaseURL: url, apiKey: key });
            alert("✅ Firebase 設定已儲存！即時連動中。");
          } else {
            window.StorageService.saveFirebaseConfig(null);
            alert("ℹ️ 已切換為本機儲存模式。");
          }
          modal.classList.remove("active");
          this.refreshData();
        });
      }
    },

    async refreshData() {
      this.allStudents = await window.StorageService.getAllStudents();
      this.updateKPICards();
      this.populateClassOptions();
      this.renderLevelAnalytics();
      this.renderWrongQuestionsLeaderboard();
      this.renderStudentsTable();
    },

    updateKPICards() {
      const list = Object.values(this.allStudents);
      const totalStudents = list.length;
      document.getElementById("kpiTotalStudents").textContent = `${totalStudents} 人`;

      // 通關達成率 (任一關通過比例)
      let passCount = 0;
      let totalStars = 0;
      let totalLevelsAttempted = 0;

      list.forEach(st => {
        [1, 2, 3].forEach(lvl => {
          const d = st.levels && st.levels[lvl];
          if (d && d.attempts > 0) {
            totalLevelsAttempted += 1;
            totalStars += (d.stars || 0);
            if (d.passed) passCount += 1;
          }
        });
      });

      const passRate = totalLevelsAttempted > 0 ? Math.round((passCount / totalLevelsAttempted) * 100) : 0;
      document.getElementById("kpiAvgPassRate").textContent = `${passRate}%`;
      document.getElementById("kpiTotalStars").textContent = `${totalStars} ★`;

      // 檢查連線狀態
      const fb = window.StorageService.getFirebaseConfig();
      const dsEl = document.getElementById("kpiDataSource");
      if (fb && fb.databaseURL) {
        dsEl.textContent = "🔥 Firebase 雲端同步";
        dsEl.style.color = "var(--val-red)";
      } else {
        dsEl.textContent = "💾 本機離線快取";
        dsEl.style.color = "var(--val-cyan)";
      }
    },

    populateClassOptions() {
      const select = document.getElementById("selectClassFilter");
      if (!select) return;

      const classes = new Set();
      Object.values(this.allStudents).forEach(st => {
        if (st.className) classes.add(st.className);
      });

      const currentVal = select.value;
      select.innerHTML = '<option value="ALL">全部班級</option>';
      Array.from(classes).sort().forEach(cls => {
        const opt = document.createElement("option");
        opt.value = cls;
        opt.textContent = cls;
        select.appendChild(opt);
      });
      select.value = currentVal;
    },

    /**
     * 渲染各關卡平均闖關次數與花費時間 (分析學生是否卡關)
     */
    async renderLevelAnalytics() {
      const container = document.getElementById("levelAnalyticsContainer");
      if (!container) return;

      const analytics = await window.StorageService.getLevelAnalytics();
      const levelNames = {
        1: "Level 1: 因數與倍數靶場",
        2: "Level 2: 3D 殭屍公因公倍防線",
        3: "Level 3: 生活情境綜合混合戰"
      };

      container.innerHTML = analytics.map(item => {
        const isStuckRisk = item.avgAttempts >= 2.5 || (item.totalParticipants > 0 && item.passRate < 60);

        return `
          <div style="background: rgba(15, 25, 35, 0.7); border: 1px solid ${isStuckRisk ? "var(--val-red)" : "var(--val-border)"}; padding: 16px; clip-path: var(--val-clip-corner-sm); position: relative;">
            <div style="font-family: var(--val-font-display); font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 8px;">
              ${levelNames[item.level]}
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0;">
              <div>
                <span class="hud-stat-label">平均闖關次數</span>
                <div style="font-size: 22px; font-weight: 700; color: ${item.avgAttempts >= 2 ? "var(--val-gold)" : "var(--val-cyan)"}; font-family: var(--val-font-display);">
                  ${item.avgAttempts} 次
                </div>
              </div>

              <div>
                <span class="hud-stat-label">平均花費時間</span>
                <div style="font-size: 22px; font-weight: 700; color: #fff; font-family: var(--val-font-display);">
                  ${item.avgTimeSeconds} 秒
                </div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 12px;">
              <span style="color: var(--val-gray-muted);">通關率 (≥85分)</span>
              <strong style="color: ${item.passRate >= 70 ? "var(--val-cyan)" : "var(--val-red)"}; font-family: var(--val-font-display); font-size: 14px;">
                ${item.passRate}% (${item.totalParticipants} 人參賽)
              </strong>
            </div>

            ${isStuckRisk ? `
              <div style="margin-top: 10px; font-size: 11px; color: var(--val-red); background: rgba(255, 70, 85, 0.15); padding: 6px; border-left: 2px solid var(--val-red);">
                🚨 卡關警戒：平均重試偏高或通過率偏低，建議課堂進行概念補救！
              </div>
            ` : ""}
          </div>
        `;
      }).join("");
    },

    /**
     * 渲染全班高頻錯題排行榜 (精準課堂補救重點)
     */
    async renderWrongQuestionsLeaderboard() {
      const container = document.getElementById("wrongQuestionsList");
      if (!container) return;

      const wrongList = await window.StorageService.getWrongQuestionStats();

      if (wrongList.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; color: var(--val-gray-muted); padding: 30px;">
            🎉 目前全班表現極佳！暫無累積錯題紀錄。
          </div>
        `;
        return;
      }

      container.innerHTML = wrongList.slice(0, 5).map((q, idx) => {
        const rankClass = idx === 0 ? "rank-1" : idx === 1 ? "rank-2" : idx === 2 ? "rank-3" : "rank-default";

        return `
          <div style="background: rgba(15, 25, 35, 0.7); border: 1px solid var(--val-border); margin-bottom: 12px; padding: 16px; clip-path: var(--val-clip-corner-sm);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span class="rank-badge ${rankClass}">#${idx + 1}</span>
                <span class="val-badge val-badge-red">Level 0${q.level} // ${q.category}</span>
                <strong style="color: #fff; font-size: 15px;">${q.prompt}</strong>
              </div>
              <div style="text-align: right; white-space: nowrap;">
                <span style="color: var(--val-red); font-weight: 700; font-family: var(--val-font-display); font-size: 18px;">
                  ${q.wrongCount} 次答錯
                </span>
                <div style="font-size: 11px; color: var(--val-gray-muted);">涵蓋 ${q.studentCount} 位學生</div>
              </div>
            </div>

            <!-- 教學精準補救引導 -->
            <div style="background: rgba(0, 245, 212, 0.08); border-left: 3px solid var(--val-cyan); padding: 10px 14px; margin-top: 10px; font-size: 13px;">
              <div style="color: var(--val-cyan); font-weight: 700; margin-bottom: 4px;">
                🎯 課堂精準補救教學引導：
              </div>
              <div style="color: var(--val-gray-light); line-height: 1.5;">
                <strong>正確答案：</strong><span style="color: var(--val-gold);">${q.answer}</span><br>
                <strong>觀念解析：</strong>${q.explanation}<br>
                <strong>記憶口訣：</strong>${q.hint}
              </div>
            </div>
          </div>
        `;
      }).join("");
    },

    /**
     * 渲染學生學習進度與通關成績總表
     */
    renderStudentsTable() {
      const tbody = document.getElementById("studentsTableBody");
      if (!tbody) return;

      let list = Object.values(this.allStudents);

      // 班級篩選
      if (this.currentClassFilter !== "ALL") {
        list = list.filter(st => st.className === this.currentClassFilter);
      }

      // 關鍵字搜尋
      if (this.searchQuery) {
        list = list.filter(st => 
          (st.studentName && st.studentName.toLowerCase().includes(this.searchQuery)) ||
          (st.studentId && st.studentId.toLowerCase().includes(this.searchQuery))
        );
      }

      if (list.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; color: var(--val-gray-muted); padding: 30px;">
              查無相符的學生學習紀錄。
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = list.map(st => {
        const l1 = (st.levels && st.levels[1]) || {};
        const l2 = (st.levels && st.levels[2]) || {};
        const l3 = (st.levels && st.levels[3]) || {};
        const totalStars = (l1.stars || 0) + (l2.stars || 0) + (l3.stars || 0);
        const totalTime = (l1.totalTimeSeconds || 0) + (l2.totalTimeSeconds || 0) + (l3.totalTimeSeconds || 0);
        const mins = Math.floor(totalTime / 60);
        const secs = totalTime % 60;

        const formatLevelCell = (lvlData) => {
          if (!lvlData.attempts) return '<span style="color: var(--val-gray-muted);">未作答</span>';
          const passPill = lvlData.passed 
            ? '<span class="val-badge val-badge-cyan" style="font-size: 10px; padding: 2px 6px;">通過</span>' 
            : '<span class="val-badge val-badge-red" style="font-size: 10px; padding: 2px 6px;">未達標</span>';
          const stars = "★".repeat(lvlData.stars || 0) + "☆".repeat(3 - (lvlData.stars || 0));
          return `
            <div>
              ${passPill} <strong>${lvlData.highScore}分</strong>
              <div style="color: var(--val-gold); font-size: 12px;">${stars} (${lvlData.attempts}次)</div>
            </div>
          `;
        };

        const timeStr = st.lastActive ? new Date(st.lastActive).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "--";

        return `
          <tr>
            <td><span class="val-badge val-badge-cyan">${st.className || "未分班"}</span></td>
            <td style="font-family: var(--val-font-display); font-weight: 700;">#${st.studentId}</td>
            <td style="font-weight: 700; color: #fff;">${st.studentName}</td>
            <td>${formatLevelCell(l1)}</td>
            <td>${formatLevelCell(l2)}</td>
            <td>${formatLevelCell(l3)}</td>
            <td style="font-family: var(--val-font-display); font-size: 16px; font-weight: 700; color: var(--val-gold);">
              ${totalStars} ★
            </td>
            <td style="font-family: var(--val-font-display);">${mins}分 ${secs}秒</td>
            <td style="font-size: 12px; color: var(--val-gray-muted);">${timeStr}</td>
          </tr>
        `;
      }).join("");
    },

    /**
     * 一鍵匯出為 Excel / CSV 檔案
     */
    async handleExportCSV() {
      const csvData = await window.StorageService.exportStudentsToCSV();
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `因數與倍數_學習成效報表_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  TeacherApp.init();
});
