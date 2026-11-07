import { cycleEducation, cycleSources } from '../mobile/src/cycle-guidance.mjs';

export default function CycleEducation({ periods, birthDate, lang }: {
  periods: { start: string; duration: number }[]; birthDate?: string; lang: 'ka' | 'en';
}) {
  const guidance = cycleEducation(periods, birthDate, lang);
  return <section className="workspace-card" aria-label={guidance.heading}>
    <h2>{guidance.heading}</h2>
    <p>{guidance.summary}</p>
    <details><summary>{lang === 'ka' ? 'როგორ ითვლის თუთა?' : 'How does Tuta calculate?'}</summary>
      {guidance.paragraphs.map(text => <p key={text}>{text}</p>)}
      <p>{lang === 'ka' ? 'წყაროები: ' : 'Sources: '}{cycleSources.map(source => <a key={source.label} href={source.url} target="_blank" rel="noopener noreferrer" className="mr-4 underline">{source.label}</a>)}</p>
    </details>
  </section>;
}
