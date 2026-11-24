/** The break between chapters: a printer's fleuron centred on a hairline rule. */
export default function ChapterRule() {
  return (
    <div aria-hidden="true" className="relative mx-auto my-16 flex max-w-[18rem] items-center justify-center sm:my-20">
      <span className="absolute inset-x-0 top-1/2 h-px bg-rule" />
      <span className="relative bg-paper px-4 font-display text-[1.375rem] leading-none text-accent">❦</span>
    </div>
  );
}
