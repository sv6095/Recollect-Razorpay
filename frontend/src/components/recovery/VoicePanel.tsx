'use client'

const WAVEFORM = [12, 20, 8, 28, 16, 4, 22, 14, 24, 10, 30, 16, 6, 18, 26, 12, 20, 4, 22, 14, 28, 16, 8, 24, 12, 18, 30, 14, 6, 20, 26, 10, 4, 16]

export function VoicePanel() {
  return (
    <section className="card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#071C36] border border-[#1A3A5C] flex items-center justify-center">
            <span className="material-symbols-outlined text-[#7AAEF5] text-[16px]">record_voice_over</span>
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[#0F172A] leading-tight">B2B Voice Agent</h3>
            <p className="text-[11px] text-[#64748B]">High-tier conversational collection</p>
          </div>
        </div>
        <span className="chip chip-default text-[10px] italic">Demo</span>
      </div>

      {/* Audio player shell */}
      <div className="p-3.5 rounded-xl bg-[#071C36] border border-[#1A3A5C] flex flex-col gap-3">
        <div className="flex items-center justify-between font-mono text-[10px] text-[#4D5F7C]">
          <span className="flex items-center gap-1.5 text-[#10B981]">
            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
            00:42 / 01:18
          </span>
          <span>PCM 16-bit · 24kHz</span>
        </div>

        {/* Waveform */}
        <svg className="w-full h-7" viewBox="0 0 204 32" preserveAspectRatio="none" fill="#528FF0" opacity="0.85">
          {WAVEFORM.map((h, i) => (
            <rect key={i} x={i * 6} y={(32 - h) / 2} width="3" height={h} rx="1.5" />
          ))}
        </svg>

        {/* Progress bar */}
        <div className="h-0.5 bg-[#1A3A5C] rounded-full overflow-hidden">
          <div className="h-full w-[54%] bg-[#528FF0] rounded-full" />
        </div>

        <p className="font-mono text-[10px] text-[#7B93B4] leading-relaxed">
          <span className="text-[#7AAEF5] font-semibold">AI Voice Agent: </span>
          &ldquo;Good afternoon, calling from Razorpay on behalf of CloudScale. We noticed invoice #INV-4829 is 15 days pending. Can we confirm authorization for today?&rdquo;
        </p>
      </div>
    </section>
  )
}
