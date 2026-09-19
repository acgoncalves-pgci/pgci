import type { ProcessCategory } from './model'

export const defaultProcessCategories = (): ProcessCategory[] => [
  { id: 'category-service', code: '01', name: 'Serviço Público', color: '#3498DB', icon: 'Landmark', observation: 'Serviços prestados pelo município ao cidadão.', active: true },
  { id: 'category-administrative', code: '02', name: 'Procedimentos Administrativos', color: '#17628B', icon: 'FileText', observation: 'Processos e procedimentos da administração municipal.', active: true },
]
