import { BrowserRouter, Routes, Route, useParams, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

// Import the actual editor components from the web app (via Vite alias)
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { AssetsPanel } from "@/components/editor/panels/assets";
import { PropertiesPanel } from "@/components/editor/panels/properties";
import { Timeline } from "@/components/editor/panels/timeline";
import { PreviewPanel } from "@/components/editor/panels/preview";
import { EditorHeader } from "@/components/editor/editor-header";
import { EditorProvider } from "@/components/providers/editor-provider";
import { Onboarding } from "@/components/editor/onboarding";
import { usePanelStore } from "@/stores/panel-store";
import { usePasteMedia } from "@/hooks/use-paste-media";
import "./globals.css";

/** Desktop editor page — uses a hardcoded project ID for now (no auth/cloud) */
function EditorPage() {
  const { project_id } = useParams();
  const projectId = project_id || "desktop-default";

  return (
    <EditorProvider projectId={projectId}>
      <div className="bg-background flex h-screen w-screen flex-col overflow-hidden">
        <EditorHeader />
        <div className="min-h-0 min-w-0 flex-1">
          <EditorLayout />
        </div>
        <Onboarding />
      </div>
    </EditorProvider>
  );
}

function EditorLayout() {
  usePasteMedia();
  const { panels, setPanel } = usePanelStore();

  return (
    <ResizablePanelGroup
      direction="vertical"
      className="size-full gap-[0.18rem]"
      onLayout={(sizes) => {
        setPanel("mainContent", sizes[0] ?? panels.mainContent);
        setPanel("timeline", sizes[1] ?? panels.timeline);
      }}
    >
      <ResizablePanel
        defaultSize={panels.mainContent}
        minSize={30}
        maxSize={85}
        className="min-h-0"
      >
        <ResizablePanelGroup
          direction="horizontal"
          className="size-full gap-[0.19rem] px-3"
          onLayout={(sizes) => {
            setPanel("tools", sizes[0] ?? panels.tools);
            setPanel("preview", sizes[1] ?? panels.preview);
            setPanel("properties", sizes[2] ?? panels.properties);
          }}
        >
          <ResizablePanel
            defaultSize={panels.tools}
            minSize={15}
            maxSize={40}
            className="min-w-0"
          >
            <AssetsPanel />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel
            defaultSize={panels.preview}
            minSize={30}
            className="min-h-0 min-w-0 flex-1"
          >
            <PreviewPanel />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel
            defaultSize={panels.properties}
            minSize={15}
            maxSize={40}
            className="min-w-0"
          >
            <PropertiesPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel
        defaultSize={panels.timeline}
        minSize={15}
        maxSize={70}
        className="min-h-0 px-3 pb-3"
      >
        <Timeline />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <TooltipProvider>
          <Routes>
            {/* Default route redirects to editor with default project */}
            <Route path="/" element={<Navigate to="/editor/desktop-default" replace />} />
            <Route path="/editor/:project_id" element={<EditorPage />} />
          </Routes>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
