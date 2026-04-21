import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-[0_8px_30px_rgba(0,0,0,0.12)] group-[.toaster]:rounded-xl group-[.toaster]:font-dm",
          title: "font-dm font-semibold",
          description: "group-[.toast]:text-muted-foreground font-dm",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:!bg-success-bg group-[.toaster]:!text-success group-[.toaster]:!border-success/30",
          error: "group-[.toaster]:!bg-danger-bg group-[.toaster]:!text-danger group-[.toaster]:!border-danger/30",
          warning: "group-[.toaster]:!bg-warning-bg group-[.toaster]:!text-warning group-[.toaster]:!border-warning/30",
          info: "group-[.toaster]:!bg-card group-[.toaster]:!text-foreground group-[.toaster]:!border-[hsl(var(--gold)/0.3)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
