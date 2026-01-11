import { useEffect, useMemo, useState } from 'react';
import {
  List,
  PieChart as PieChartIcon,
  Receipt,
  RefreshCw,
  Search,
  Settings
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const RENT_AND_UTILITIES_FIXED = 40000;
const SHARED_SUBCATEGORIES = ["日用品", "デート（立替）", "外食", "食費", "普段使い（立替）", "旅費"];
const FULL_REIMBURSE_SUBCATEGORY = "立替（全額）";
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
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

    return {
      totalBilling,
      myAdvanceTotal,
      girlfriendPayment: totalBilling,
      summary: {
        rent: RENT_AND_UTILITIES_FIXED,
        shared: sharedTotal,
        sharedHalf,
        full: fullReimburseTotal
      },
      bySubcategory,
      details: [...sharedDetails, ...fullReimburseDetails].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      )
    };
  }, [data, selectedYear, selectedMonth]);

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
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center">初期設定</h1>
          <form onSubmit={saveConfig}>
            <label className="block text-sm font-medium text-gray-700 mb-2">GAS WebアプリのURL</label>
            <input
              type="text"
              className="w-full p-3 border border-gray-300 rounded-lg mb-4 text-sm"
              placeholder="https://script.google.com/macros/s/.../exec"
              value={gasUrl}
              onChange={(event) => setGasUrl(event.target.value)}
              required
            />
            <button className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition">
              設定を保存して開始
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600">読み込み中...</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-6">
        <p className="text-gray-600">{errorMessage}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={fetchData}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            再読み込み
          </button>
          <button
            onClick={() => setIsConfiguring(true)}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition"
          >
            URLを変更
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">同棲費用ダッシュボード</h1>
          <p className="text-gray-500 mt-1 text-sm">スプレッドシート連携モード</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="bg-white border rounded-lg px-3 py-2 text-sm shadow-sm"
            value={selectedYear}
            onChange={(event) => setSelectedYear(parseInt(event.target.value, 10))}
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}年
              </option>
            ))}
          </select>
          <select
            className="bg-white border rounded-lg px-3 py-2 text-sm shadow-sm"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(parseInt(event.target.value, 10))}
          >
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
              <option key={month} value={month}>
                {month}月
              </option>
            ))}
          </select>
          <button
            onClick={fetchData}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
            title="データを更新"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsConfiguring(true)}
            className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition"
            title="設定"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {report && report.details.length === 0 && (
        <div className="bg-white p-12 rounded-2xl border shadow-sm text-center">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            選択された年月のデータ（計算対象=1 かつ 有効な中項目）が見つかりません。
          </p>
        </div>
      )}

      {report && report.details.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-blue-600 text-white rounded-2xl p-6 shadow-lg shadow-blue-200">
              <p className="text-sm opacity-80 mb-1">請求額合計</p>
              <p className="text-3xl font-bold">¥{report.totalBilling.toLocaleString()}</p>
              <p className="text-xs mt-3 opacity-70">家賃・光熱費(4万) + 折半分 + 全額立替</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border shadow-sm">
              <p className="text-sm text-gray-500 mb-1">私の立替総額</p>
              <p className="text-3xl font-bold text-gray-900">¥{report.myAdvanceTotal.toLocaleString()}</p>
              <p className="text-xs mt-3 text-gray-400">実際に支払った総額</p>
            </div>
            <div className="bg-emerald-600 text-white rounded-2xl p-6 shadow-lg shadow-emerald-200">
              <p className="text-sm opacity-80 mb-1">彼女の支払額</p>
              <p className="text-3xl font-bold">¥{report.girlfriendPayment.toLocaleString()}</p>
              <p className="text-xs mt-3 opacity-70">今月の精算額</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <h2 className="font-bold mb-6 flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-blue-500" />
                カテゴリ別内訳
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(report.bySubcategory).map(([name, value]) => ({ name, value }))}
                      dataKey="value"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                    >
                      {Object.entries(report.bySubcategory).map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `¥${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {Object.entries(report.bySubcategory).map(([name, value], index) => (
                  <div key={name} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></div>
                    <span className="text-gray-600 truncate">
                      {name}: ¥{value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <h2 className="font-bold mb-6 flex items-center gap-2">
                <List className="w-5 h-5 text-emerald-500" />
                計算詳細
              </h2>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-500">家賃・光熱費(固定)</span>
                  <span className="font-semibold">¥{report.summary.rent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-500">共同生活費(総額)</span>
                  <span>¥{report.summary.shared.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-500 pl-4">→ 折半負担(50%)</span>
                  <span className="font-semibold text-blue-600">
                    ¥{report.summary.sharedHalf.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-500">立替全額(100%)</span>
                  <span className="font-semibold text-emerald-600">
                    ¥{report.summary.full.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="p-6 border-b bg-gray-50">
              <h2 className="font-bold flex items-center gap-2">
                <Receipt className="w-5 h-5 text-orange-500" />
                支出明細
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-3 font-medium">日付</th>
                    <th className="px-6 py-3 font-medium">内容 / メモ</th>
                    <th className="px-6 py-3 font-medium">中項目</th>
                    <th className="px-6 py-3 font-medium text-right">金額</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.details.map((item, index) => (
                    <tr key={`${item.date}-${index}`} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{item.date}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 line-clamp-2" title={item.content}>
                          {item.content}
                        </div>
                        {item.memo && (
                          <div className="text-xs text-gray-400 mt-1 italic">{item.memo}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                            item.subcategory === FULL_REIMBURSE_SUBCATEGORY
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {item.subcategory}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold whitespace-nowrap">
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
    </div>
  );
};

export default App;
