export interface IGutterBlockButtonOptions {
    ariaLabel: string;
    type: string;
    subtype: string;
    nodeID: string;
    icon: string;
    embedID?: string;
    popoverHTML?: string;
    draggable: boolean;
    prominentAdd?: boolean;
}

export const genGutterBlockButtonHTML = (options: IGutterBlockButtonOptions) => {
    const embedHTML = options.embedID ? ` data-embed-id="${options.embedID}"` : "";
    const className = options.prominentAdd ? "ariaLabel protyle-gutters__add" : "ariaLabel";
    const icon = options.prominentAdd ? "iconAdd" : options.icon;
    return `<button class="${className}" data-delay="500" data-position="parentW" aria-label="${options.ariaLabel}"
data-type="${options.type}" data-subtype="${options.subtype}" data-node-id="${options.nodeID}"${embedHTML}>
    <svg><use xlink:href="#${icon}"></use></svg>
    <span ${options.popoverHTML || ""} ${options.draggable ? 'draggable="true"' : ""}></span>
</button>`;
};

export const canShowGutterInsert = (embedID?: string) => !embedID;
