import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppShell } from '@/components/layout/app-shell'
import { ALL_NAV_ITEMS } from '@/components/layout/nav'
import { PropertiesPage } from '@/features/properties/pages/properties-page'
import { PropertyEditPlaceholder, PropertyPage } from '@/features/properties/pages/property-page'
import { ModulePlaceholderPage } from '@/pages/module-placeholder-page'
import { UiKitPage } from '@/pages/ui-kit-page'
import { StoreProvider } from '@/store/db'

/** Routes. Sections not rebuilt yet get a placeholder page from the nav list, so every menu item works. */
export default function App() {
  return (
    <StoreProvider>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/properties" replace />} />
              <Route path="properties" element={<PropertiesPage />} />
              <Route path="properties/new" element={<PropertyEditPlaceholder />} />
              <Route path="properties/drafts" element={<PropertyEditPlaceholder />} />
              <Route path="properties/:id/edit" element={<PropertyEditPlaceholder />} />
              <Route path="properties/:id/:tab?" element={<PropertyPage />} />
              <Route path="ui-kit" element={<UiKitPage />} />
              {ALL_NAV_ITEMS.filter((i) => !i.ready).map((i) => (
                <Route key={i.to} path={i.to.slice(1) + '/*'} element={<ModulePlaceholderPage item={i} />} />
              ))}
              <Route path="*" element={<Navigate to="/properties" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors closeButton />
      </TooltipProvider>
    </StoreProvider>
  )
}
