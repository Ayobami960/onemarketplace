
interface LoadingProps {
  message?: string;
}

const Loading = ({ message = "Checking your session..." }: LoadingProps) => {
  return (
    <main className="grid min-h-svh place-items-center bg-[#fbfcfa] px-6">
      <div className="flex flex-col items-center gap-4 text-center" role="status" aria-live="polite">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-[#dcebd9] border-t-[#4c7849]" />
        <p className="text-sm font-medium text-[#62675f]">{message}</p>
      </div>
    </main>
  )
}

export default Loading