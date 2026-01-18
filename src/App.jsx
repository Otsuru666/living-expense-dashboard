import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Heart,
  List,
  PieChart as PieChartIcon,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  Wallet
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

const RENT_AND_UTILITIES_FIXED = 40000;
const SHARED_SUBCATEGORIES = ["日用品", "デート（立替）", "外食", "食費", "普段使い（立替）", "旅費"];
const FULL_REIMBURSE_SUBCATEGORY = "立替（全額）";
const COLORS = ['#e8927c', '#2d6a7c', '#d4a574', '#f4a896', '#3d7a8c', '#f7baa8'];
const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbxBbgtIC0A7rmRO-TxoQfSJgpagbSmN8GP0Ui_6AtfGQB40ZzMVvE8-EvzYePpoe4Rc/exec';

const readLocalStorage = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
};

const writeLocalStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    return;
  }
};

const parseYenInput = (value) => {
  const cleaned = String(value || '').replace(/[^0-9]/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
};

const getGirlfriendAdvanceKey = (year, month) => `girlfriend_advance_${year}-${month}`;

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card-light rounded-xl px-4 py-3">
        <p className="text-white/90 font-semibold text-sm">{payload[0].name}</p>
        <p className="text-coral-400 font-bold text-lg">¥{payload[0].value.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

const App = () => {
  const envGasUrl = (import.meta.env.VITE_GAS_URL || '').trim();
  const storedGasUrl = readLocalStorage('gas_url');
  const initialGasUrl = storedGasUrl || envGasUrl || DEFAULT_GAS_URL;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [gasUrl, setGasUrl] = useState(initialGasUrl);
  const [isConfiguring, setIsConfiguring] = useState(!initialGasUrl);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' | 'yearly'
  const [girlfriendAdvanceInput, setGirlfriendAdvanceInput] = useState(() => {
    return readLocalStorage(getGirlfriendAdvanceKey(new Date().getFullYear(), new Date().getMonth() + 1)) || '';
  });

  const girlfriendAdvance = useMemo(() => parseYenInput(girlfriendAdvanceInput), [girlfriendAdvanceInput]);

  useEffect(() => {
    const stored = readLocalStorage(getGirlfriendAdvanceKey(selectedYear, selectedMonth));
    setGirlfriendAdvanceInput(stored || '');
  }, [selectedYear, selectedMonth]);

  const availableYears = useMemo(() => {
    if (!data) return [new Date().getFullYear()];
    const years = new Set();
    data.forEach((row) => {
      const d = new Date(row["日付"]);
      if (!Number.isNaN(d.getTime())) years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [data]);

  const fetchData = async () => {
    if (!gasUrl) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(gasUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('APIの応答に失敗しました');
      }
      const json = await response.json();
      if (!Array.isArray(json)) {
        throw new Error('想定外のデータ形式です');
      }
      setData(json);

      if (json.length > 0) {
        let maxDate = new Date(0);
        json.forEach((row) => {
          const d = new Date(row["日付"]);
          if (!Number.isNaN(d.getTime()) && d > maxDate) {
            maxDate = d;
          }
        });
        if (maxDate.getTime() > 0) {
          setSelectedYear(maxDate.getFullYear());
          setSelectedMonth(maxDate.getMonth() + 1);
        }
      }
    } catch (error) {
      setErrorMessage('データの取得に失敗しました。URLや公開設定を確認してください。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gasUrl && !isConfiguring) {
      fetchData();
    }
  }, [gasUrl, isConfiguring]);

  const report = useMemo(() => {
    if (!data) return null;

    const filtered = data.filter((row) => {
      if (row["計算対象"] != "1") return false;
      const d = new Date(row["日付"]);
      return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
    });

    let sharedTotal = 0;
    let fullReimburseTotal = 0;
    const sharedDetails = [];
    const fullReimburseDetails = [];
    const bySubcategory = {};

    filtered.forEach((row) => {
      const rawAmount = String(row["金額（円）"] || '0').replace(/,/g, '');
      const amount = Math.abs(parseInt(rawAmount, 10)) || 0;
      const sub = row["中項目"] || '';

      if (sub.includes('自費')) return;

      const detail = {
        date: row["日付"],
        content: row["内容"],
        category: row["大項目"],
        subcategory: sub,
        amount: amount,
        memo: row["メモ"] || ''
      };

      if (sub === FULL_REIMBURSE_SUBCATEGORY) {
        fullReimburseTotal += amount;
        fullReimburseDetails.push(detail);
        bySubcategory[sub] = (bySubcategory[sub] || 0) + amount;
      } else if (SHARED_SUBCATEGORIES.includes(sub)) {
        sharedTotal += amount;
        sharedDetails.push(detail);
        bySubcategory[sub] = (bySubcategory[sub] || 0) + amount;
      }
    });

    const sharedHalf = Math.floor(sharedTotal / 2);
    const totalBilling = RENT_AND_UTILITIES_FIXED + sharedHalf + fullReimburseTotal;
    const myAdvanceTotal = RENT_AND_UTILITIES_FIXED + sharedTotal + fullReimburseTotal;
    const girlfriendAdvanceHalf = Math.floor(girlfriendAdvance / 2);
    const girlfriendPayment = totalBilling - girlfriendAdvanceHalf;

    return {
      totalBilling,
      myAdvanceTotal,
      girlfriendPayment,
      summary: {
        rent: RENT_AND_UTILITIES_FIXED,
        shared: sharedTotal,
        sharedHalf,
        full: fullReimburseTotal,
        girlfriendAdvance,
        girlfriendAdvanceHalf
      },
      bySubcategory,
      details: [...sharedDetails, ...fullReimburseDetails].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      )
    };
  }, [data, selectedYear, selectedMonth, girlfriendAdvance]);

  // 年間集計ロジック
  const yearlyReport = useMemo(() => {
    if (!data) return null;

    const yearData = data.filter((row) => {
      if (row["計算対象"] != "1") return false;
      const d = new Date(row["日付"]);
      return d.getFullYear() === selectedYear;
    });

    // 月別データの初期化（1-12月）- 同棲関連費用のみ（家賃除く）
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: `${i + 1}月`,
      monthNum: i + 1,
      shared: 0,
      full: 0,
      total: 0
    }));

    // 中項目別集計用
    const bySubcategoryYearly = {};

    // 月ごとにデータを集計
    const monthlyBreakdown = {};
    for (let m = 1; m <= 12; m++) {
      monthlyBreakdown[m] = {};
    }

    yearData.forEach((row) => {
      const rawAmount = String(row["金額（円）"] || '0').replace(/,/g, '');
      const amount = Math.abs(parseInt(rawAmount, 10)) || 0;
      const sub = row["中項目"] || '';
      const d = new Date(row["日付"]);
      const monthNum = d.getMonth() + 1;

      if (sub.includes('自費')) return;

      // 同棲関連項目のみ集計（折半対象 or 全額立替）
      const isShared = SHARED_SUBCATEGORIES.includes(sub);
      const isFull = sub === FULL_REIMBURSE_SUBCATEGORY;
      if (!isShared && !isFull) return;

      // 中項目別年間集計
      bySubcategoryYearly[sub] = (bySubcategoryYearly[sub] || 0) + amount;

      // 月別内訳
      if (!monthlyBreakdown[monthNum][sub]) {
        monthlyBreakdown[monthNum][sub] = 0;
      }
      monthlyBreakdown[monthNum][sub] += amount;

      // 月別グラフデータ
      const monthIndex = monthNum - 1;
      if (isFull) {
        monthlyData[monthIndex].full += amount;
        monthlyData[monthIndex].total += amount;
      } else if (isShared) {
        monthlyData[monthIndex].shared += Math.floor(amount / 2);
        monthlyData[monthIndex].total += Math.floor(amount / 2);
      }
    });

    // 年間サマリー計算
    let yearlySharedTotal = 0;
    let yearlyFullTotal = 0;

    yearData.forEach((row) => {
      const rawAmount = String(row["金額（円）"] || '0').replace(/,/g, '');
      const amount = Math.abs(parseInt(rawAmount, 10)) || 0;
      const sub = row["中項目"] || '';

      if (sub.includes('自費')) return;

      if (sub === FULL_REIMBURSE_SUBCATEGORY) {
        yearlyFullTotal += amount;
      } else if (SHARED_SUBCATEGORIES.includes(sub)) {
        yearlySharedTotal += amount;
      }
    });

    // 各月の立替入力を取得して合計
    let totalGirlfriendAdvance = 0;
    for (let m = 1; m <= 12; m++) {
      const stored = readLocalStorage(getGirlfriendAdvanceKey(selectedYear, m));
      if (stored) {
        totalGirlfriendAdvance += parseYenInput(stored);
      }
    }

    // 年間集計は同棲関連費用のみ（家賃・光熱費を除く）
    const yearlySharedHalf = Math.floor(yearlySharedTotal / 2);
    const yearlyTotalBilling = yearlySharedHalf + yearlyFullTotal;
    const yearlyMyAdvance = yearlySharedTotal + yearlyFullTotal;
    const yearlyGirlfriendAdvanceHalf = Math.floor(totalGirlfriendAdvance / 2);
    const yearlyGirlfriendPayment = yearlyTotalBilling - yearlyGirlfriendAdvanceHalf;

    // 中項目別テーブル用データ（金額順ソート）
    const subcategoryTableData = Object.entries(bySubcategoryYearly)
      .map(([name, total]) => ({
        name,
        total,
        monthAvg: Math.floor(total / 12),
        monthly: Array.from({ length: 12 }, (_, i) => monthlyBreakdown[i + 1][name] || 0)
      }))
      .sort((a, b) => b.total - a.total);

    // 食関連（外食＋食費）の合計を計算
    const foodCategories = ['外食', '食費'];
    const foodTotal = foodCategories.reduce((sum, cat) => sum + (bySubcategoryYearly[cat] || 0), 0);
    const foodMonthly = Array.from({ length: 12 }, (_, i) =>
      foodCategories.reduce((sum, cat) => sum + (monthlyBreakdown[i + 1][cat] || 0), 0)
    );

    return {
      totalBilling: yearlyTotalBilling,
      myAdvanceTotal: yearlyMyAdvance,
      girlfriendPayment: yearlyGirlfriendPayment,
      summary: {
        shared: yearlySharedTotal,
        sharedHalf: yearlySharedHalf,
        full: yearlyFullTotal,
        girlfriendAdvance: totalGirlfriendAdvance,
        girlfriendAdvanceHalf: yearlyGirlfriendAdvanceHalf
      },
      monthlyData,
      subcategoryTableData,
      foodSummary: {
        total: foodTotal,
        monthAvg: Math.floor(foodTotal / 12),
        monthly: foodMonthly
      },
      hasData: yearData.length > 0
    };
  }, [data, selectedYear]);

  const saveConfig = (event) => {
    event.preventDefault();
    const normalized = gasUrl.trim();
    if (!normalized) return;
    setGasUrl(normalized);
    writeLocalStorage('gas_url', normalized);
    setIsConfiguring(false);
  };

  if (isConfiguring) {
    return (
      <div className="mesh-gradient-bg min-h-screen flex items-center justify-center p-4">
        <div className="glass-card rounded-3xl p-8 max-w-md w-full animate-fade-in-up">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-coral-500 to-coral-400 flex items-center justify-center animate-float">
              <Settings className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-display text-3xl font-semibold text-white mb-2">初期設定</h1>
            <p className="text-white/60 text-sm">データソースの設定を行います</p>
          </div>
          <form onSubmit={saveConfig}>
            <label className="block text-sm font-medium text-white/80 mb-2">GAS WebアプリのURL</label>
            <input
              type="text"
              className="glass-input w-full p-4 rounded-xl mb-6 text-sm"
              placeholder="https://script.google.com/macros/s/.../exec"
              value={gasUrl}
              onChange={(event) => setGasUrl(event.target.value)}
              required
            />
            <button className="glass-button-primary w-full p-4 rounded-xl text-lg">
              設定を保存して開始
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mesh-gradient-bg min-h-screen flex flex-col items-center justify-center gap-6">
        <div className="loader-ring"></div>
        <p className="text-white/70 font-medium animate-pulse">データを読み込んでいます...</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="mesh-gradient-bg min-h-screen flex flex-col items-center justify-center gap-6 px-6">
        <div className="glass-card rounded-3xl p-8 max-w-md w-full text-center animate-fade-in-up">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-coral-500/20 flex items-center justify-center">
            <Search className="w-8 h-8 text-coral-400" />
          </div>
          <p className="text-white/80 mb-6">{errorMessage}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={fetchData}
              className="glass-button-primary flex-1 px-6 py-3 rounded-xl"
            >
              再読み込み
            </button>
            <button
              onClick={() => setIsConfiguring(true)}
              className="glass-button flex-1 px-6 py-3 rounded-xl"
            >
              URLを変更
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mesh-gradient-bg min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <header className="animate-fade-in-up mb-10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-coral-500 to-coral-400 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-white" />
                </div>
                <span className="text-white/50 text-sm font-medium tracking-wider uppercase">Living Together</span>
              </div>
              <h1 className="font-display text-4xl sm:text-5xl font-semibold text-white tracking-tight">
                同棲費用ダッシュボード
              </h1>
              <p className="text-white/50 mt-2 text-sm">スプレッドシート連携で家計をスマートに管理</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* タブUI */}
              <div className="flex rounded-xl overflow-hidden border border-white/20">
                <button
                  onClick={() => setViewMode('monthly')}
                  className={`px-4 py-2.5 text-sm font-medium transition-all ${
                    viewMode === 'monthly'
                      ? 'bg-coral-500 text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  月別
                </button>
                <button
                  onClick={() => setViewMode('yearly')}
                  className={`px-4 py-2.5 text-sm font-medium transition-all flex items-center gap-1.5 ${
                    viewMode === 'yearly'
                      ? 'bg-coral-500 text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  年間
                </button>
              </div>
              <select
                className="glass-select rounded-xl px-4 py-3 text-sm min-w-[100px]"
                value={selectedYear}
                onChange={(event) => setSelectedYear(parseInt(event.target.value, 10))}
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}年
                  </option>
                ))}
              </select>
              {viewMode === 'monthly' && (
                <select
                  className="glass-select rounded-xl px-4 py-3 text-sm min-w-[90px]"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(parseInt(event.target.value, 10))}
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                    <option key={month} value={month}>
                      {month}月
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={fetchData}
                className="glass-button p-3 rounded-xl group"
                title="データを更新"
              >
                <RefreshCw className="w-5 h-5 text-white/70 group-hover:text-coral-400 transition-colors group-hover:rotate-180 duration-500" />
              </button>
              <button
                onClick={() => setIsConfiguring(true)}
                className="glass-button p-3 rounded-xl group"
                title="設定"
              >
                <Settings className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
              </button>
            </div>
          </div>
        </header>

        {/* Advance Input Card - 月別ビュー時のみ編集可能 */}
        {viewMode === 'monthly' ? (
          <div className="glass-card rounded-2xl p-5 mb-8 animate-fade-in-up animate-delay-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">幸恵の立替入力</h2>
                  <p className="text-xs text-white/50">入力額の折半分が支払額から差し引かれます</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  className="glass-input w-40 text-right p-3 rounded-xl text-sm font-semibold"
                  placeholder="例: 12000"
                  value={girlfriendAdvanceInput}
                  onChange={(event) => {
                    const cleaned = event.target.value.replace(/[^0-9]/g, '');
                    setGirlfriendAdvanceInput(cleaned);
                    writeLocalStorage(getGirlfriendAdvanceKey(selectedYear, selectedMonth), cleaned);
                  }}
                />
                <span className="text-sm text-white/50 font-medium">円</span>
              </div>
            </div>
          </div>
        ) : (
          yearlyReport && (
            <div className="glass-card rounded-2xl p-5 mb-8 animate-fade-in-up animate-delay-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">幸恵の立替合計（年間）</h2>
                    <p className="text-xs text-white/50">各月の立替入力の合計額です</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-teal-400">
                    ¥{yearlyReport.summary.girlfriendAdvance.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )
        )}

        {/* 月別ビュー: データなし表示 */}
        {viewMode === 'monthly' && report && report.details.length === 0 && (
          <div className="glass-card rounded-3xl p-16 text-center animate-fade-in-up animate-delay-2">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/5 flex items-center justify-center">
              <Search className="w-10 h-10 text-white/30" />
            </div>
            <p className="text-white/50 text-lg">
              選択された年月のデータが見つかりません
            </p>
            <p className="text-white/30 text-sm mt-2">
              計算対象=1 かつ 有効な中項目のデータを確認してください
            </p>
          </div>
        )}

        {/* 年間ビュー: データなし表示 */}
        {viewMode === 'yearly' && yearlyReport && !yearlyReport.hasData && (
          <div className="glass-card rounded-3xl p-16 text-center animate-fade-in-up animate-delay-2">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/5 flex items-center justify-center">
              <Search className="w-10 h-10 text-white/30" />
            </div>
            <p className="text-white/50 text-lg">
              {selectedYear}年のデータが見つかりません
            </p>
            <p className="text-white/30 text-sm mt-2">
              計算対象=1 かつ 有効な中項目のデータを確認してください
            </p>
          </div>
        )}

        {/* 年間ビューUI */}
        {viewMode === 'yearly' && yearlyReport && yearlyReport.hasData && (
          <>
            {/* 年間サマリーカード */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
              <div className="summary-card-primary rounded-3xl p-6 animate-fade-in-up animate-delay-2 group hover:scale-[1.02] transition-transform duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-6 h-6 text-white/80" />
                  </div>
                  <span className="text-xs text-white/50 uppercase tracking-wider">Yearly Total</span>
                </div>
                <p className="text-sm text-white/70 mb-1">年間請求額合計</p>
                <p className="font-display text-5xl font-bold text-white tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                  ¥{yearlyReport.totalBilling.toLocaleString()}
                </p>
                <p className="text-xs mt-4 text-white/40">折半負担 + 全額立替（家賃除く）</p>
              </div>

              <div className="summary-card-secondary rounded-3xl p-6 animate-fade-in-up animate-delay-3 group hover:scale-[1.02] transition-transform duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Wallet className="w-6 h-6 text-white/80" />
                  </div>
                  <span className="text-xs text-white/50 uppercase tracking-wider">Yearly Paid</span>
                </div>
                <p className="text-sm text-white/70 mb-1">年間立替総額</p>
                <p className="font-display text-5xl font-bold text-white tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                  ¥{yearlyReport.myAdvanceTotal.toLocaleString()}
                </p>
                <p className="text-xs mt-4 text-white/40">同棲関連費用の立替総額</p>
              </div>

              <div className="summary-card-accent rounded-3xl p-6 animate-fade-in-up animate-delay-4 pulse-glow group hover:scale-[1.02] transition-transform duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs text-white/70 uppercase tracking-wider">Yearly Due</span>
                </div>
                <p className="text-sm text-white/80 mb-1">年間支払額</p>
                <p className="font-display text-5xl font-bold text-white tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                  ¥{yearlyReport.girlfriendPayment.toLocaleString()}
                </p>
                <p className="text-xs mt-4 text-white/60">幸恵の年間精算額</p>
                {yearlyReport.summary.girlfriendAdvance > 0 && (
                  <p className="text-xs mt-1 text-white/60">
                    立替合計(折半): -¥{yearlyReport.summary.girlfriendAdvanceHalf.toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* 月別推移グラフと計算詳細 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
              {/* 月別推移グラフ */}
              <div className="glass-card rounded-3xl p-6 animate-fade-in-up animate-delay-5">
                <h2 className="font-display text-xl font-semibold text-white mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-coral-500/20 flex items-center justify-center">
                    <PieChartIcon className="w-5 h-5 text-coral-400" />
                  </div>
                  月別推移
                </h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearlyReport.monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                      />
                      <YAxis
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                        tickFormatter={(value) => `${Math.floor(value / 10000)}万`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(30, 58, 95, 0.95)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '12px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }}
                        labelStyle={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}
                        formatter={(value, name) => {
                          const labels = { shared: '折半負担', full: '全額立替' };
                          return [`¥${value.toLocaleString()}`, labels[name] || name];
                        }}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: '10px' }}
                        formatter={(value) => {
                          const labels = { shared: '折半負担', full: '全額立替' };
                          return <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>{labels[value] || value}</span>;
                        }}
                      />
                      <Bar dataKey="shared" stackId="a" fill="#d4a574" name="shared" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="full" stackId="a" fill="#e8927c" name="full" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 年間計算詳細 */}
              <div className="glass-card rounded-3xl p-6 animate-fade-in-up animate-delay-6">
                <h2 className="font-display text-xl font-semibold text-white mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                    <List className="w-5 h-5 text-teal-400" />
                  </div>
                  年間計算詳細
                </h2>
                <div className="space-y-1">
                  <div className="flex justify-between py-3 border-b border-white/10">
                    <span className="text-white/60">折半対象費用(年間総額)</span>
                    <span className="text-white/80">¥{yearlyReport.summary.shared.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-white/10">
                    <span className="text-white/60 pl-4">→ 折半負担(50%)</span>
                    <span className="font-semibold text-teal-400">
                      ¥{yearlyReport.summary.sharedHalf.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-white/10">
                    <span className="text-white/60">立替全額(100%)</span>
                    <span className="font-semibold text-coral-400">
                      ¥{yearlyReport.summary.full.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-white/10">
                    <span className="text-white/60">幸恵の立替合計(年間)</span>
                    <span className="text-white/80">¥{yearlyReport.summary.girlfriendAdvance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-white/10">
                    <span className="text-white/60">差引(折半分)</span>
                    <span className="text-white/80">-¥{yearlyReport.summary.girlfriendAdvanceHalf.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-4 mt-2 rounded-xl bg-coral-500/10 px-4 -mx-4">
                    <span className="text-white font-medium">年間精算額</span>
                    <span className="font-bold text-coral-400 text-lg">
                      ¥{yearlyReport.girlfriendPayment.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 中項目別 年間集計テーブル */}
            <div className="glass-table rounded-3xl overflow-hidden animate-fade-in-up animate-delay-6">
              <div className="p-6 border-b border-white/10">
                <h2 className="font-display text-xl font-semibold text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-gold" />
                  </div>
                  中項目別 年間集計
                  <span className="ml-auto text-sm font-normal text-white/40">
                    {yearlyReport.subcategoryTableData.length}項目
                  </span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/50 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 text-left font-medium sticky left-0 bg-white/5 backdrop-blur-sm">中項目</th>
                      <th className="px-4 py-4 text-right font-medium">年間合計</th>
                      <th className="px-4 py-4 text-right font-medium">月平均</th>
                      {Array.from({ length: 12 }, (_, i) => (
                        <th key={i} className="px-3 py-4 text-right font-medium whitespace-nowrap">
                          {i + 1}月
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyReport.subcategoryTableData.map((item, index) => (
                      <tr key={item.name} className="group">
                        <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white/5 backdrop-blur-sm">
                          <span
                            className={`category-badge px-3 py-1.5 rounded-full text-xs font-semibold ${
                              item.name === FULL_REIMBURSE_SUBCATEGORY
                                ? 'bg-coral-500/20 text-coral-400'
                                : 'bg-gold/20 text-gold'
                            }`}
                          >
                            {item.name}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-white whitespace-nowrap">
                          ¥{item.total.toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-right text-white/60 whitespace-nowrap">
                          ¥{item.monthAvg.toLocaleString()}
                        </td>
                        {item.monthly.map((amount, monthIndex) => (
                          <td
                            key={monthIndex}
                            className={`px-3 py-4 text-right whitespace-nowrap ${
                              amount > 0 ? 'text-white/80' : 'text-white/30'
                            }`}
                          >
                            {amount > 0 ? `¥${amount.toLocaleString()}` : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  {yearlyReport.foodSummary.total > 0 && (
                    <tfoot>
                      <tr className="bg-teal-500/10 border-t-2 border-teal-500/30">
                        <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-teal-500/10 backdrop-blur-sm">
                          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-teal-500/30 text-teal-300">
                            🍽️ 食関連 合計
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-teal-300 whitespace-nowrap text-base">
                          ¥{yearlyReport.foodSummary.total.toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-right text-teal-400/80 whitespace-nowrap">
                          ¥{yearlyReport.foodSummary.monthAvg.toLocaleString()}
                        </td>
                        {yearlyReport.foodSummary.monthly.map((amount, monthIndex) => (
                          <td
                            key={monthIndex}
                            className={`px-3 py-4 text-right whitespace-nowrap ${
                              amount > 0 ? 'text-teal-400/80' : 'text-white/30'
                            }`}
                          >
                            {amount > 0 ? `¥${amount.toLocaleString()}` : '-'}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}

        {/* 月別ビュー */}
        {viewMode === 'monthly' && report && report.details.length > 0 && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
              <div className="summary-card-primary rounded-3xl p-6 animate-fade-in-up animate-delay-2 group hover:scale-[1.02] transition-transform duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-6 h-6 text-white/80" />
                  </div>
                  <span className="text-xs text-white/50 uppercase tracking-wider">Total</span>
                </div>
                <p className="text-sm text-white/70 mb-1">請求額合計</p>
                <p className="font-display text-6xl font-bold text-white tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                  ¥{report.totalBilling.toLocaleString()}
                </p>
                <p className="text-xs mt-4 text-white/40">家賃・光熱費 + 折半分 + 全額立替</p>
              </div>

              <div className="summary-card-secondary rounded-3xl p-6 animate-fade-in-up animate-delay-3 group hover:scale-[1.02] transition-transform duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Wallet className="w-6 h-6 text-white/80" />
                  </div>
                  <span className="text-xs text-white/50 uppercase tracking-wider">Paid</span>
                </div>
                <p className="text-sm text-white/70 mb-1">優翔の立替総額</p>
                <p className="font-display text-6xl font-bold text-white tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                  ¥{report.myAdvanceTotal.toLocaleString()}
                </p>
                <p className="text-xs mt-4 text-white/40">実際に支払った総額</p>
              </div>

              <div className="summary-card-accent rounded-3xl p-6 animate-fade-in-up animate-delay-4 pulse-glow group hover:scale-[1.02] transition-transform duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs text-white/70 uppercase tracking-wider">Due</span>
                </div>
                <p className="text-sm text-white/80 mb-1">幸恵の支払額</p>
                <p className="font-display text-6xl font-bold text-white tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                  ¥{report.girlfriendPayment.toLocaleString()}
                </p>
                <p className="text-xs mt-4 text-white/60">今月の精算額</p>
                {report.summary.girlfriendAdvance > 0 && (
                  <p className="text-xs mt-1 text-white/60">
                    立替入力(折半): -¥{report.summary.girlfriendAdvanceHalf.toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Charts and Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
              {/* Pie Chart */}
              <div className="glass-card rounded-3xl p-6 animate-fade-in-up animate-delay-5">
                <h2 className="font-display text-xl font-semibold text-white mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-coral-500/20 flex items-center justify-center">
                    <PieChartIcon className="w-5 h-5 text-coral-400" />
                  </div>
                  カテゴリ別内訳
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(report.bySubcategory).map(([name, value]) => ({ name, value }))}
                        dataKey="value"
                        innerRadius={70}
                        outerRadius={95}
                        paddingAngle={4}
                        animationBegin={300}
                        animationDuration={800}
                      >
                        {Object.entries(report.bySubcategory).map((_, index) => (
                          <Cell
                            key={index}
                            fill={COLORS[index % COLORS.length]}
                            stroke="transparent"
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  {Object.entries(report.bySubcategory).map(([name, value], index) => (
                    <div key={name} className="flex items-center gap-2 text-sm group cursor-default">
                      <div
                        className="w-3 h-3 rounded-full shrink-0 group-hover:scale-125 transition-transform"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      ></div>
                      <span className="text-white/60 truncate group-hover:text-white/80 transition-colors">
                        {name}
                      </span>
                      <span className="text-white/80 font-semibold ml-auto">
                        ¥{value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calculation Details */}
              <div className="glass-card rounded-3xl p-6 animate-fade-in-up animate-delay-6">
                <h2 className="font-display text-xl font-semibold text-white mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                    <List className="w-5 h-5 text-teal-400" />
                  </div>
                  計算詳細
                </h2>
                <div className="space-y-1">
                  <div className="flex justify-between py-3 border-b border-white/10">
                    <span className="text-white/60">家賃・光熱費(固定)</span>
                    <span className="font-semibold text-white">¥{report.summary.rent.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-white/10">
                    <span className="text-white/60">共同生活費(総額)</span>
                    <span className="text-white/80">¥{report.summary.shared.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-white/10">
                    <span className="text-white/60 pl-4">→ 折半負担(50%)</span>
                    <span className="font-semibold text-teal-400">
                      ¥{report.summary.sharedHalf.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-white/10">
                    <span className="text-white/60">立替全額(100%)</span>
                    <span className="font-semibold text-coral-400">
                      ¥{report.summary.full.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-white/10">
                    <span className="text-white/60">幸恵の立替入力(合計)</span>
                    <span className="text-white/80">¥{report.summary.girlfriendAdvance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-white/10">
                    <span className="text-white/60">差引(折半分)</span>
                    <span className="text-white/80">-¥{report.summary.girlfriendAdvanceHalf.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-4 mt-2 rounded-xl bg-coral-500/10 px-4 -mx-4">
                    <span className="text-white font-medium">差引後の幸恵支払額</span>
                    <span className="font-bold text-coral-400 text-lg">
                      ¥{report.girlfriendPayment.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Expense Table */}
            <div className="glass-table rounded-3xl overflow-hidden animate-fade-in-up animate-delay-6">
              <div className="p-6 border-b border-white/10">
                <h2 className="font-display text-xl font-semibold text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-gold" />
                  </div>
                  支出明細
                  <span className="ml-auto text-sm font-normal text-white/40">
                    {report.details.length}件
                  </span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/50 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 text-left font-medium">日付</th>
                      <th className="px-6 py-4 text-left font-medium">内容 / メモ</th>
                      <th className="px-6 py-4 text-left font-medium">中項目</th>
                      <th className="px-6 py-4 text-right font-medium">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.details.map((item, index) => (
                      <tr key={`${item.date}-${index}`} className="group">
                        <td className="px-6 py-4 text-white/50 whitespace-nowrap">{item.date}</td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-white/90 line-clamp-2 group-hover:text-white transition-colors" title={item.content}>
                            {item.content}
                          </div>
                          {item.memo && (
                            <div className="text-xs text-white/40 mt-1 italic">{item.memo}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`category-badge px-3 py-1.5 rounded-full text-xs font-semibold ${
                              item.subcategory === FULL_REIMBURSE_SUBCATEGORY
                                ? 'bg-coral-500/20 text-coral-400'
                                : 'bg-gold/20 text-gold'
                            }`}
                          >
                            {item.subcategory}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-white whitespace-nowrap">
                          ¥{item.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <footer className="mt-16 text-center text-white/30 text-xs animate-fade-in-up">
          <p>Living Expense Dashboard • Built with love</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
