import React from "react";
import { motion } from "framer-motion";
import { Button } from "./ui/Button";

export const Hero = () => {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden pt-20">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -z-10 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 bg-brand-gradient opacity-[0.08] blur-[120px]" />
      <div className="absolute top-0 left-0 -z-10 h-full w-full bg-mesh-gradient opacity-40" />

      <div className="container relative z-10 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <h1 className="mx-auto max-w-4xl font-display text-5xl font-bold leading-tight tracking-tight text-brand-text md:text-7xl">
            Build your startup with{" "}
            <span className="bg-brand-gradient bg-clip-text text-transparent">
              Emotional Intelligence
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-brand-text-muted md:text-xl">
            Meet BUZZ, your psychologically aware AI companion. SoftLaunch helps you build, scale, and stay sane while doing it.
          </p>
          
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg">Start Building Now</Button>
            <Button variant="secondary" size="lg">Watch Demo</Button>
          </div>
        </motion.div>
      </div>

      {/* Subtle floor glow */}
      <div className="absolute bottom-0 left-0 h-24 w-full bg-gradient-to-t from-brand-bg-primary to-transparent" />
    </section>
  );
};
