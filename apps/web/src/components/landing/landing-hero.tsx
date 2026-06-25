"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"

export function LandingHero() {
  return (
    <section className="landing-hero border-b border-border text-center">
      <div className="landing-hero-content">
        <div className="landing-hero-eyebrow border border-primary/20 bg-primary/5 text-primary">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          Now available for NestJS
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground mb-6" style={{ background: "var(--hero-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Requirement-to-Code<br />Impact Analyzer
        </h1>
        <p className="landing-hero-subtitle text-lg md:text-xl text-muted-foreground mx-auto">
          Map business requirements to backend code artifacts with persisted evidence, explicit unknowns, and human review before approval.
        </p>
        <div className="landing-hero-actions">
          <Link href="/login?next=/analyses">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-md px-8 h-12">
              Open Real Demo Workspace
            </Button>
          </Link>
          <Link href="https://github.com/hungthinh1104/BA_Helper" target="_blank">
            <Button size="lg" variant="outline" className="text-md px-8 h-12">
              View Project Source
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-12 mx-auto max-w-xl rounded-2xl border border-border/60 bg-surface/80 p-5 shadow-sm">
        <p className="text-sm font-semibold text-foreground">Real demo path</p>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Use the workspace to connect the tested public NestJS repository, run a scan, create a requirement revision, review evidence-backed impacts, and finalize the report from live backend data.
        </p>
        <Link href="/login?next=/repositories" className="mt-4 inline-flex w-full">
          <Button size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-md h-12">
            Start from Repository Scan
          </Button>
        </Link>
      </div>
    </section>
  )
}
