import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface PaginationOptions {
    pageHeight: number;
    pageGap: number;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        autoPagination: {
            setPageHeight: (height: number) => ReturnType;
        };
    }
}

export const AutoPagination = Extension.create<PaginationOptions>({
    name: 'autoPagination',

    addOptions() {
        return {
            pageHeight: 1056,
            pageGap: 50,
        };
    },

    addCommands() {
        return {
            setPageHeight: (height: number) => ({ tr, dispatch }) => {
                if (dispatch) {
                    tr.setMeta('auto-pagination-height', height);
                }
                return true;
            },
        };
    },

    addProseMirrorPlugins() {
        const { pageHeight, pageGap } = this.options;
        const pluginKey = new PluginKey('auto-pagination');

        return [
            new Plugin({
                key: pluginKey,
                state: {
                    init() {
                        return { height: pageHeight, decos: DecorationSet.empty };
                    },
                    apply(tr, oldState) {
                        const newHeight = tr.getMeta('auto-pagination-height');
                        const height = newHeight !== undefined ? newHeight : oldState.height;

                        const metaDecos = tr.getMeta(pluginKey);
                        if (metaDecos) {
                            return { height, decos: metaDecos };
                        }

                        return {
                            height,
                            decos: oldState.decos.map(tr.mapping, tr.doc)
                        };
                    },
                },
                props: {
                    decorations(state) {
                        return this.getState(state)?.decos;
                    },
                },
                view(editorView) {
                    let debounceTimer: any = null;

                    const measureAndDecorate = () => {
                        if (!editorView || editorView.isDestroyed) return;

                        const { state } = editorView;
                        const pluginState = pluginKey.getState(state);
                        const currentHeight = pluginState?.height || pageHeight;

                        const decos: Decoration[] = [];
                        const domNodes = Array.from(editorView.dom.children) as HTMLElement[];

                        let pixelThreshold = currentHeight;
                        let pageIndex = 1;

                        for (const child of domNodes) {
                            const bottom = child.offsetTop + child.offsetHeight;

                            if (bottom > pixelThreshold) {
                                const pos = editorView.posAtDOM(child, 0);
                                if (pos === null) continue;

                                const widget = Decoration.widget(pos, () => {
                                    const div = document.createElement('div');
                                    div.className = 'daydream-page-break';
                                    div.style.height = `${pageGap}px`;
                                    div.dataset.page = (pageIndex + 1).toString();
                                    return div;
                                }, { side: -1 });

                                decos.push(widget);
                                pixelThreshold += (currentHeight + pageGap);
                                pageIndex++;
                            }
                        }

                        const tr = state.tr.setMeta(pluginKey, DecorationSet.create(state.doc, decos));
                        editorView.dispatch(tr);
                    };

                    return {
                        update(view, prevState) {
                            const pluginState = pluginKey.getState(view.state);
                            const oldPluginState = pluginKey.getState(prevState);

                            if (prevState.doc.eq(view.state.doc) === false || pluginState?.height !== oldPluginState?.height) {
                                clearTimeout(debounceTimer);
                                debounceTimer = setTimeout(measureAndDecorate, 350);
                            }
                        }
                    };
                },
            }),
        ];
    },
});
