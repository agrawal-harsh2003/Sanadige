export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8f3ec] flex flex-col">
      <header className="border-b border-[#e0d9d0] bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <p className="font-bold text-xl tracking-tight text-[#1a3a38]" style={{ fontFamily: 'Georgia, serif', letterSpacing: '0.1em' }}>Sanadige</p>
          <p className="text-[11px] text-[#8a7f75] mt-0.5">New Delhi · Fine Dining</p>
        </div>
        <p className="text-xs text-[#8a7f75]">Book a Table</p>
      </header>
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        {children}
      </main>
      <footer className="border-t border-[#e0d9d0] px-6 py-4 text-center text-xs text-[#8a7f75]">
        Questions? WhatsApp us or call +91 91678 85275
      </footer>
    </div>
  )
}
