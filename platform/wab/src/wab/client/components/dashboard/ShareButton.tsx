import ShareDialog from "@/wab/client/components/widgets/ShareDialog";
import {
  DefaultShareButtonProps,
  PlasmicShareButton,
} from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicShareButton";
import { ApiPermission, ApiResource } from "@/wab/shared/ApiSchema";
import * as React from "react";

interface ShareButtonProps extends DefaultShareButtonProps {
  resource: ApiResource;
  perms: ApiPermission[];
  reloadPerms: (perms: ApiPermission[]) => Promise<void>;
}

function ShareButton(props: ShareButtonProps) {
  const { resource, perms, reloadPerms, ...rest } = props;
  const [modal, setModal] = React.useState(false);
  return (
    <>
      <PlasmicShareButton {...rest} onClick={() => setModal(true)} />
      <ShareDialog
        open={modal}
        resource={resource}
        perms={perms}
        closeDialog={() => setModal(false)}
        reloadPerms={reloadPerms}
      />
    </>
  );
}

export default ShareButton;
