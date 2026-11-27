/**
 * Route-level error boundary (DESIGN_SYSTEM §11.10): a page that throws shows the ErrorState with Try again and
 * Go to Today, while the shell (sidebar, topbar) keeps working. The layout keys it by pathname, so navigating resets it.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Trans } from 'react-i18next'
import { ErrorState } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'

type Props = { children: ReactNode; onGoHome: () => void }
type State = { error: Error | null }

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surfaced for developers; the user sees the friendly state below.
    console.error('Route error', error, info.componentStack)
  }

  private reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <section role="alert" className="rounded-lg border bg-card shadow-card">
        <h1 className="sr-only">
          <Trans i18nKey="common:error.title" />
        </h1>
        <EmptyState
          illustration={ErrorState}
          title={<Trans i18nKey="common:error.title" />}
          body={
            <>
              <Trans i18nKey="common:error.body" />
              <details className="mt-3 text-left text-meta text-subtle-foreground">
                <summary className="cursor-pointer">
                  <Trans i18nKey="common:error.details" />
                </summary>
                <code className="mt-1 block break-all">{error.message}</code>
              </details>
            </>
          }
          primary={
            <Button onClick={this.reset}>
              <Trans i18nKey="common:actions.tryAgain" />
            </Button>
          }
          secondary={
            <Button
              variant="secondary"
              onClick={() => {
                this.reset()
                this.props.onGoHome()
              }}
            >
              <Trans i18nKey="common:actions.goToday" />
            </Button>
          }
        />
      </section>
    )
  }
}
