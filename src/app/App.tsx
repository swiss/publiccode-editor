import "bootstrap-switzerland/dist/css/bootstrap-switzerland.min.css";
import { NotificationManager } from "design-react-kit";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import "react-widgets/styles.css";
import "../assets/main.css";
import Editor from "./components/Editor";
import Head from "./components/Head";
import Layout from "./components/Layout";
import SettingsPanel from "./components/SettingsPanel";
import WarningBox from "./components/WarningBox";
import YamlPreview from "./components/YamlPreview";
import { useIsMobile } from "./lib/utils";

const NOTIFICATION_TIMEOUT = 4_000;
// portal: set only by src/embed.tsx, which renders inside a host page that has its own header.
// It is a body-level node, so fixed overlays escape the host page's stacking contexts.
export const App = ({ portal }: { portal?: HTMLElement }) => {
  const isMobile = useIsMobile();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading] = useState(false);
  const { t } = useTranslation();

  const leftPanel = (
    <div className="content__wrapper">
      <Editor />
    </div>
  );

  const rightPanel = (
    <div className="content__sidebar" id="content-sidebar">
      <WarningBox />
      <YamlPreview />
    </div>
  );

  const notifications = (
    <NotificationManager
      duration={NOTIFICATION_TIMEOUT}
      fix="top"
      closeOnClick={false}
      // above the host page's header when portaled; bootstrap modals are 1050
      style={portal ? { position: "relative", zIndex: 1060 } : { zIndex: 10 }}
    />
  );

  return (
    <div className={portal ? "editor--embedded" : undefined}>
      {isLoading && (
        <div className="d-flex align-items-center col-12 position-absolute h-100 w-100">
          <div className="mr-auto ml-auto">
            <h3>{t("validation.inprogress")}</h3>
            <div
              className="spinner-grow text-primary"
              role="status"
              aria-hidden="true"
            />
          </div>
        </div>
      )}
      <Layout isLoading={isLoading}>
        <div>
          {portal ? createPortal(notifications, portal) : notifications}
          {!portal && (
            <div className="content__head">
              <Head
                onSettingsClick={() => setIsSettingsOpen(!isSettingsOpen)}
              />
            </div>
          )}
          <SettingsPanel
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
          <div className="content">
            {isMobile ? (
              <div className="content__mobile">
                {leftPanel}
                {rightPanel}
              </div>
            ) : (
              <PanelGroup direction="horizontal">
                <Panel id="editor-panel" defaultSize={100}>
                  {leftPanel}
                </Panel>
                <PanelResizeHandle className="panel-resize-handle" />
                <Panel id="preview-panel" defaultSize={80}>
                  {rightPanel}
                </Panel>
              </PanelGroup>
            )}
          </div>
        </div>
      </Layout>
    </div>
  );
};

export default App;
