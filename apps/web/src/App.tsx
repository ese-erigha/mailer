import { Route, Routes } from 'react-router-dom'

import { ROUTE } from './routes.ts'
import { ConnectScreen } from './screens/connect-screen.tsx'
import { ConnectedScreen } from './screens/connected-screen.tsx'
import { ErrorScreen } from './screens/error-screen.tsx'

export function App() {
  return (
    <Routes>
      <Route path={ROUTE.home} element={<ConnectScreen />} />
      <Route path={ROUTE.connected} element={<ConnectedScreen />} />
      <Route path={ROUTE.error} element={<ErrorScreen />} />
    </Routes>
  )
}
