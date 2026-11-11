import { Route, Routes } from 'react-router-dom'

import { ROUTE } from './routes.ts'
import { ConnectScreen } from './screens/connect-screen.tsx'

export function App() {
  return (
    <Routes>
      <Route path={ROUTE.home} element={<ConnectScreen />} />
    </Routes>
  )
}
