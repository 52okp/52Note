/** 清理旧布局中的云收集箱，保留其他面板的顺序和配置对象。 */
export const removeRetiredDockEntries = <T extends {type: string}>(entries: T[]) => {
    for (let index = entries.length - 1; index >= 0; index--) {
        if (entries[index].type === "inbox") {
            entries.splice(index, 1);
        }
    }
};
