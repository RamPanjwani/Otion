export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 space-y-8">
      <header className="text-center space-y-2 mb-10">
        <h1 className="text-4xl font-extrabold text-emerald-400">
          Otion Component Styling Playground
        </h1>
        <p className="text-slate-400 text-sm">
          Demonstrating Tailwind CSS utility combinations across custom Note Cards
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
        
        {/* CARD 1 */}
        <div className="w-64 h-32 text-xs bg-red-500 text-black font-light text-left px-8 py-4 mb-4 border border-slate-900 rounded shadow hover:bg-blue-800 hover:text-white transition-all cursor-pointer flex flex-col justify-between">
          <h3 className="font-bold underline">Card 1</h3>
          <p>text-xs | bg-red-500 | font-light | text-left | border & rounded | shadow</p>
        </div>

        {/* CARD 2 */}
        <div className="w-72 h-36 text-sm bg-blue-600 text-yellow-300 font-normal text-center p-4 m-2 border-2 border-yellow-300 rounded-md shadow-md hover:bg-red-600 hover:text-white hover:scale-105 transition-all cursor-pointer flex flex-col justify-between">
          <h3 className="font-bold underline">Card 2</h3>
          <p>text-sm | bg-blue-600 | font-normal | text-center | border-2 | shadow-md</p>
        </div>

        {/* CARD 3 */}
        <div className="w-80 h-40 text-base bg-emerald-600 text-white font-medium text-right pt-4 pb-2 pl-6 pr-4 border-4 border-emerald-900 rounded-lg shadow-lg hover:bg-purple-700 hover:text-pink-200 transition-all cursor-pointer flex flex-col justify-between">
          <h3 className="font-bold underline">Card 3</h3>
          <p>text-base | bg-emerald-600 | font-medium | text-right | border-4 | shadow-lg</p>
        </div>

        {/* CARD 4 */}
        <div className="w-64 h-36 text-lg bg-purple-700 text-pink-200 font-semibold text-left px-6 py-3 border-2 border-pink-400 rounded-xl shadow-xl hover:bg-emerald-500 hover:text-black hover:scale-105 transition-all cursor-pointer flex flex-col justify-between">
          <h3 className="font-bold underline">Card 4</h3>
          <p>text-lg | bg-purple-700 | font-semibold | text-left | rounded-xl | shadow-xl</p>
        </div>

        {/* CARD 5 */}
        <div className="w-80 h-44 text-xl bg-amber-600 text-black font-bold text-center p-6 border-4 border-black rounded-2xl shadow-2xl hover:bg-slate-800 hover:text-yellow-300 transition-all cursor-pointer flex flex-col justify-between">
          <h3 className="font-bold underline">Card 5</h3>
          <p>text-xl | bg-amber-600 | font-bold | text-center | rounded-2xl | shadow-2xl</p>
        </div>

        {/* CARD 6 */}
        <div className="w-72 h-48 text-2xl bg-cyan-700 text-white font-extrabold text-right p-4 border-2 border-white rounded-full shadow-lg hover:bg-red-500 hover:scale-110 transition-all cursor-pointer flex flex-col justify-center items-center text-center">
          <h3 className="font-bold underline mb-1">Card 6</h3>
          <p className="text-xs font-normal">text-2xl | bg-cyan-700 | font-extrabold | rounded-full</p>
        </div>

        {/* CARD 7 */}
        <div className="w-full max-w-xs h-36 text-3xl bg-slate-800 text-emerald-400 font-black text-left px-4 py-2 border border-emerald-400 rounded-md shadow-md hover:bg-emerald-400 hover:text-slate-900 transition-all cursor-pointer flex flex-col justify-between">
          <h3 className="text-lg underline">Card 7</h3>
          <p className="text-xs font-light">text-3xl header styling with w-full max-w-xs container constraint.</p>
        </div>

      </div>
    </div>
  );
}