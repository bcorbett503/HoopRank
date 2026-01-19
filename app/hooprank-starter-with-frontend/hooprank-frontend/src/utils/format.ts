export const toFixed = (n: number, d = 1) => Number.isFinite(n) ? n.toFixed(d) : '—'
export const pct = (n: number, d = 1) => Number.isFinite(n) ? (n*100).toFixed(d) + '%' : '—'
export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')
export const initials = (name: string) => name.split(' ').map(p=>p.charAt(0)).join('').slice(0,2).toUpperCase()
