import next from 'eslint-config-next'

const config = [
  ...next,
  { ignores: ['.next/**', 'node_modules/**', 'scratch/**', 'functions/**'] },
  // The UI resets view state in effects and reads the clock while rendering charts; both are intended here.
  { rules: { 'react-hooks/set-state-in-effect': 'warn', 'react-hooks/purity': 'warn', '@next/next/no-img-element': 'off' } },
]

export default config
