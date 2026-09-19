import { motion } from "framer-motion";
import { Bell, Sparkles, Receipt } from "lucide-react";

export default function FeatureGrid() {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 22 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const features = [
    {
      icon: Bell,
      chipClass: "amber",
      title: "Smart reminders",
      description:
        "AI-timed alerts that reach you days before due dates, not after late fees and stress strike.",
    },
    {
      icon: Sparkles,
      chipClass: "primary",
      title: "Ask Duewell — AI assistant",
      description:
        "Chat naturally about upcoming dues, your monthly spending rhythm, or payment summaries.",
    },
    {
      icon: Receipt,
      chipClass: "green",
      title: "One view of every bill",
      description:
        "Consolidate broadband, utilities, credit cards, insurance, and taxes in one calm timeline.",
    },
  ];

  return (
    <section id="features" className="features-section max-w-5xl mx-auto px-6 py-14 md:py-20">
      <div className="text-center max-w-xl mx-auto mb-12">
        <p className="eyebrow mb-2">Designed for peace of mind</p>
        <h2
          className="text-2xl sm:text-3xl md:text-4xl font-normal text-foreground"
          style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
        >
          Everything you need to stay ahead.
        </h2>
      </div>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-6"
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.25 }}
      >
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.title}
              variants={itemVariants}
              className="rounded-2xl border border-border bg-card p-6 flex flex-col items-start hover:border-primary/30 transition-all duration-200"
            >
              <div
                className={`summary-icon ${feature.chipClass} mb-5`}
                style={{ width: "42px", height: "42px", borderRadius: "12px" }}
              >
                <Icon size={19} />
              </div>

              <h3
                className="text-lg font-normal text-foreground mb-2"
                style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
              >
                {feature.title}
              </h3>

              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
