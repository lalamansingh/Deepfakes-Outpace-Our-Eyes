import { ArrowRight, Bot, Brain, Camera, Check, Eye, EyeOff, Lightbulb, Lock, MousePointerClick, School, ShieldCheck, Timer, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink, Card, Eyebrow } from "@/components/ui";
import { SiteFooter, SiteHeader, SkipLink } from "@/components/player/site-chrome";

const steps = [
  {
    icon: Eye,
    title: "See it",
    text: "A photo, a voice clip or a short video. Eight items a day, about five minutes.",
  },
  {
    icon: MousePointerClick,
    title: "Decide",
    text: "Real or Rendered? Then say how sure you are, from “just guessing” to “certain”.",
  },
  {
    icon: Lightbulb,
    title: "Learn",
    text: "See the clues you missed, highlighted right on the image, plus the original source.",
  },
];

/** Decorative preview of the game stage (no real media, so nothing to label). */
function StagePreview() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md select-none">
      <div className="rounded-[1.75rem] border border-white/10 bg-plum-2/80 p-4 shadow-[0_30px_80px_rgb(0_0_0/0.5)] backdrop-blur">
        <div className="mb-3 flex items-center justify-between text-xs text-white/60">
          <span className="font-semibold text-white">Item 3 of 8</span>
          <span className="flex gap-1">
            <span className="size-2 rounded-full bg-ora" />
            <span className="size-2 rounded-full bg-wine" />
            <span className="h-2 w-5 rounded-full bg-ora" />
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="size-2 rounded-full bg-white/20" />
            ))}
          </span>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_30%_35%,var(--color-ora-light),transparent_45%),radial-gradient(circle_at_75%_70%,var(--color-wine),transparent_55%),linear-gradient(160deg,var(--color-plum-3),var(--color-plum))]">
          <div className="absolute left-[18%] top-[22%] h-[38%] w-[30%] rounded-full bg-white/10 blur-sm" />
          <div className="absolute left-[56%] top-[48%] h-[30%] w-[26%] rounded-lg border-[3px] border-ora bg-ora/10">
            <span className="absolute -left-[3px] -top-[3px] grid size-5 place-items-center rounded-br-md rounded-tl-md bg-ora text-[10px] font-bold text-plum">
              1
            </span>
          </div>
          <div className="absolute left-[8%] top-[60%] h-[22%] w-[22%] rounded-lg border-[3px] border-white/80">
            <span className="absolute -left-[3px] -top-[3px] grid size-5 place-items-center rounded-br-md rounded-tl-md bg-white text-[10px] font-bold text-plum">
              2
            </span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-semibold text-white">
            <Camera className="size-4" /> Real
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-gradient-ora px-3 py-2.5 text-sm font-semibold text-white">
            <Bot className="size-4" /> Rendered
          </div>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-white/60">
            <span>How sure?</span>
            <span className="font-bold text-ora">80%</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-white/15">
            <div className="h-full w-[60%] rounded-full bg-ora" />
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -right-2 flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-xl sm:-right-6">
        <span className="grid size-6 place-items-center rounded-full bg-gradient-ora text-white">
          <Check className="size-4" strokeWidth={3} />
        </span>
        Correct · +80
      </div>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-tint text-wine">{icon}</span>
      <div>
        <h3 className="font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <SkipLink />
      <div className="absolute inset-x-0 top-0 z-10">
        <SiteHeader transparent />
      </div>
      <main id="main" className="flex-1">
        <div className="bg-brand-dark text-white">
          <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-36 sm:px-6 sm:pt-28 lg:grid-cols-[1.1fr_1fr] lg:pb-28 lg:pt-32">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                <Timer className="size-3.5 text-ora" aria-hidden /> 5 minutes a day · free · no account
              </p>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Deepfakes outpace <span className="bg-linear-to-br from-ora-light to-ora-deep bg-clip-text text-transparent">our eyes.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/75">
                Real or Rendered? is a daily game that trains you to spot AI-generated images, voices and videos, and to know when you
                simply can&apos;t tell. Guess, rate your confidence, then learn the clues you missed.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ButtonLink href="/play" className="px-6 py-4 text-base">
                  Play today&apos;s challenge <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
                <ButtonLink href="/spot" variant="dark" className="px-6 py-4 text-base">
                  Spot the fake
                </ButtonLink>
                <ButtonLink href="/practice" variant="dark" className="px-6 py-4 text-base">
                  Practice
                </ButtonLink>
                <ButtonLink href="/join" variant="dark" className="px-6 py-4 text-base">
                  <Users className="size-4" aria-hidden /> Join a class
                </ButtonLink>
              </div>
            </div>
            <StagePreview />
          </section>
        </div>

        <section aria-labelledby="how-heading" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Eyebrow>How it works</Eyebrow>
          <h2 id="how-heading" className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Three steps, eight items, one sharper eye.
          </h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <li key={title}>
                <Card className="h-full p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="grid size-12 place-items-center rounded-2xl bg-gradient-wine text-white">
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <span className="text-4xl font-extrabold text-line" aria-hidden>
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-ink">
                    <span className="sr-only">Step {i + 1}: </span>
                    {title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-muted">{text}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="why-heading" className="bg-tint/70">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <Eyebrow>Why it matters</Eyebrow>
              <h2 id="why-heading" className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                Most of us think we can spot a fake. Most of us can&apos;t.
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                In a 2022 study published in <em>PNAS</em>, people judged AI-generated faces at about chance level, and rated them as slightly
                more trustworthy than real ones. The danger isn&apos;t only being fooled; it&apos;s being <strong className="text-ink">sure</strong> you
                weren&apos;t.
              </p>
              <p className="mt-4 leading-relaxed text-muted">
                That&apos;s why every answer comes with a confidence rating. Your score rewards honesty, and your progress page shows whether
                your gut deserves your trust.
              </p>
            </div>
            <Card className="p-6 sm:p-8">
              <p className="text-sm font-semibold text-muted">A typical first week</p>
              <div className="mt-5 flex flex-col gap-5">
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-ink">How sure</span>
                    <span className="font-bold text-ora-deep">High</span>
                  </div>
                  <div className="mt-1.5 h-3 rounded-full bg-tint">
                    <div className="h-full w-[85%] rounded-full bg-gradient-ora" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-ink">How right</span>
                    <span className="font-bold text-wine">Much lower</span>
                  </div>
                  <div className="mt-1.5 h-3 rounded-full bg-tint">
                    <div className="h-full w-[58%] rounded-full bg-gradient-wine" />
                  </div>
                </div>
              </div>
              <p className="mt-6 flex items-start gap-2 text-sm text-muted">
                <Brain className="mt-0.5 size-4 shrink-0 text-wine" aria-hidden />
                The gap between the two bars is overconfidence. Closing it is the goal.
              </p>
            </Card>
          </div>
        </section>

        <section aria-labelledby="teachers-heading" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2">
            <div className="rounded-[1.75rem] bg-brand-dark p-8 text-white sm:p-10">
              <School className="size-9 text-ora" aria-hidden />
              <h2 id="teachers-heading" className="mt-4 text-2xl font-bold sm:text-3xl">
                For teachers
              </h2>
              <p className="mt-3 leading-relaxed text-white/75">
                Create a class in seconds and share a 6-character code. Students play with a nickname; you see class accuracy, calibration and
                the clue types they struggle with, ready for a ten-minute media-literacy discussion.
              </p>
              <ButtonLink href="/staff/login" className="mt-6">
                Teacher sign-in <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
            </div>

            <div className="flex flex-col justify-center gap-7">
              <div>
                <Eyebrow>Privacy promise</Eyebrow>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Play without giving anything away.</h2>
              </div>
              <Feature icon={<EyeOff className="size-5" aria-hidden />} title="No account, ever">
                No email, no password, no real name. Just start playing.
              </Feature>
              <Feature icon={<Lock className="size-5" aria-hidden />} title="Anonymous by design">
                A single anonymous cookie remembers your streak on this device. No ads, no trackers.
              </Feature>
              <Feature icon={<ShieldCheck className="size-5" aria-hidden />} title="Classes see nicknames only">
                Joining a class shares your chosen nickname and game results with your teacher, nothing else.
              </Feature>
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-[1.75rem] bg-gradient-ora p-8 text-white sm:flex-row sm:items-center sm:p-10">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">Ready for today&apos;s eight?</h2>
              <p className="mt-1 text-white/90">It takes five minutes. Your streak starts now.</p>
            </div>
            <Link
              href="/play"
              className="inline-flex items-center gap-2 rounded-2xl bg-plum px-6 py-4 font-semibold text-white transition hover:bg-plum-2 focus-visible:outline-white"
            >
              Play now <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
