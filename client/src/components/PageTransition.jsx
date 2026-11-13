import { motion } from 'motion/react';

export default function PageTransition({ children, className = '', as = 'div', scrollRef }) {
  const Component = motion[as] || motion.div;
  return (
    <Component
      ref={scrollRef}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </Component>
  );
}
