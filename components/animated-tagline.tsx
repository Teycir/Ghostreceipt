'use client';

import { motion } from 'framer-motion';

interface AnimatedTaglineProps {
  readonly text: string;
}

export function AnimatedTagline({ text }: AnimatedTaglineProps): React.JSX.Element {
  const chars = text.split('').map((char, i) => ({ char, id: `${char}-${i}` }));

  return (
    <motion.p
      className="text-base text-white/50 tracking-wide text-center cursor-default"
      initial="hidden"
      animate="visible"
      whileHover={{
        scale: 1.04,
        textShadow: '0 0 20px rgba(255,255,255,0.7), 0 0 40px rgba(96,165,250,0.4)',
        transition: { duration: 0.24 },
      }}
    >
      {chars.map((item, i) => (
        <motion.span
          key={item.id}
          className="inline-block"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.2,
            delay: i * 0.024,
            ease: 'easeOut',
          }}
          whileHover={{
            y: -2,
            color: '#ffffff',
            textShadow: '0 0 10px rgba(255,255,255,0.9)',
            transition: { duration: 0.12 },
          }}
        >
          {item.char === ' ' ? '\u00A0' : item.char}
        </motion.span>
      ))}
    </motion.p>
  );
}
