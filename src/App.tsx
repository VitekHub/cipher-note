import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { ThemeProvider } from '@/shared/lib/theme-provider'

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <div className="bg-background text-foreground min-h-screen">
        <main className="container mx-auto flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Cipher Note</CardTitle>
              <CardDescription>End-to-end encrypted note taking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Your notes. Your privacy. Your control.</p>
              <Button className="w-full">Get Started</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    </ThemeProvider>
  )
}

export default App
