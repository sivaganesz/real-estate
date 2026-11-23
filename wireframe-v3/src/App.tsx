import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppShell } from '@/components/app-shell'
import { AddPage } from '@/pages/add/add-page'
import { ComingNextPage } from '@/pages/coming-next-page'
import { PropertiesPage } from '@/pages/properties/properties-page'
import { PropertyPage } from '@/pages/property/property-page'
import { StoreProvider } from '@/store/db'

export default function App() {
  return (
    <StoreProvider>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/properties" replace />} />
              <Route path="properties" element={<PropertiesPage />} />
              <Route path="properties/new" element={<AddPage mode="add" />} />
              <Route path="properties/import" element={<ComingNextPage />} />
              <Route path="properties/:id/edit" element={<AddPage mode="edit" />} />
              <Route path="properties/:id" element={<PropertyPage />} />
              <Route path="*" element={<Navigate to="/properties" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors closeButton />
      </TooltipProvider>
    </StoreProvider>
  )
}
