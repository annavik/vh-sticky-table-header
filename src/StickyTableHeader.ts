/**
 * This class is used for both table sticky header and horizontal scroll support on tables.
 */
export default class StickyTableHeader {
  private sizeListener?: EventListener;
  private scrollListener?: EventListener;
  private currentFrameRequest?: number;
  private containerScrollListener?: EventListener;
  private clickListener?: (event: MouseEvent) => any;
  private tableContainerParent: HTMLDivElement;
  private tableContainer: HTMLTableElement;
  private cloneContainer: HTMLTableElement;
  private cloneContainerParent: HTMLDivElement;
  private cloneHeader: any = null;
  private scrollParents: HTMLElement[];
  private header: HTMLTableRowElement;
  private lastElement: HTMLElement | null = null;
  private lastElementRefresh: number | null = null;
  private top: { max: number | string; [key: number]: number | string };

  constructor(
    tableContainer: HTMLTableElement,
    cloneContainer: HTMLTableElement,
    top?: { max: number | string; [key: number]: number | string },
  ) {
    const header = tableContainer.querySelector<HTMLTableRowElement>('thead');
    this.tableContainer = tableContainer;
    this.cloneContainer = cloneContainer;
    this.top = top || {max: 0};

    if (!header || !this.tableContainer.parentNode) {
      throw new Error('Header or parent node of sticky header table container not found!');
    }

    this.tableContainerParent = this.tableContainer.parentNode as HTMLDivElement;
    this.cloneContainerParent = this.cloneContainer.parentNode as HTMLDivElement;
    this.header = header;
    this.scrollParents = this.getScrollParents(this.tableContainer);

    this.setup();
  }

  private getScrollParents(node: HTMLElement): HTMLElement[] {
    const parents: HTMLElement[] = [];
    let parent: any = node.parentNode;

    while (parent) {
      if (parent.scrollHeight > parent.clientHeight && parent !== window) {
        parents.push(parent);
      }
      parent = parent.parentNode as HTMLElement | null;
    }

    return parents;
  }

  public destroy(): void {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
      this.scrollParents.forEach((parent) => {
        parent.removeEventListener('scroll', this.scrollListener!);
      });
    }
    if (this.currentFrameRequest) {
      window.cancelAnimationFrame(this.currentFrameRequest);
    }
    if (this.sizeListener) {
      window.removeEventListener('resize', this.sizeListener);
    }
    if (this.containerScrollListener) {
      this.tableContainerParent.removeEventListener('click', this.containerScrollListener);
    }
    if (this.clickListener) {
      this.cloneContainer.removeEventListener('click', this.clickListener);
    }
    if (this.cloneHeader) {
      this.cloneContainer.removeChild(this.cloneHeader);
    }
  }

  private setupClickEventMirroring(): void {
    this.clickListener = (event: MouseEvent) => {
      let containerRect = this.tableContainer.getBoundingClientRect();
      let cloneRect = this.cloneContainer.getBoundingClientRect();
      const bodyRect = document.body.getBoundingClientRect();
      const currentScroll = window.scrollY;
      window.scrollTo({ top: containerRect.y - bodyRect.y - this.getTop() - 60 });

      containerRect = this.tableContainer.getBoundingClientRect();
      const originalTarget = document.elementFromPoint(
        containerRect.x + (event.clientX - cloneRect.x),
        containerRect.y + (event.clientY - cloneRect.y),
      );
      if (originalTarget && (originalTarget as HTMLElement).click) {
        (originalTarget as HTMLElement).click();
      }
      window.scrollTo({top: currentScroll});
    };
    this.cloneContainer.addEventListener('click', this.clickListener);
  }

  private setupSticky(): void {
    if (this.cloneContainerParent.parentNode) {
      (this.cloneContainerParent.parentNode as HTMLElement).style.position = 'relative';
    }

    const updateSticky = () => {
      this.currentFrameRequest = window.requestAnimationFrame(() => {
        const tableRect = this.tableContainer.getBoundingClientRect();
        const tableOffsetTop = this.tableContainer.offsetTop;
        const tableTop = tableRect.y;
        const tableBottom = this.getBottom();

        const diffTop = - tableTop;
        const diffBottom = - tableBottom;
        const topPx = this.getTop();

        if (diffTop > -topPx && this.cloneHeader === null) {
          this.cloneContainerParent.style.display = 'none';
          this.cloneHeader = this.createClone();
        }

        if (this.cloneHeader !== null) {
          if (diffTop <= -topPx) {
            this.cloneContainerParent.style.display = 'none';
            this.cloneContainer.removeChild(this.cloneHeader);
            this.cloneHeader = null;
          } else if (diffBottom < -topPx) {
            this.cloneContainerParent.style.display = 'block';
            this.cloneContainerParent.style.position = 'fixed';
            this.cloneContainerParent.style.top = `${topPx}px`;
            this.setHorizontalScrollOnClone();
          } else {
            this.cloneContainerParent.style.display = 'block';
            this.cloneContainerParent.style.position = 'absolute';
            this.cloneContainerParent.style.top = `${tableBottom - tableTop + tableOffsetTop}px`;
          }
        }
      });
    };
    this.scrollListener = () => updateSticky();
    updateSticky();

    window.addEventListener('scroll', this.scrollListener);
    this.scrollParents.forEach((parent) => {
      parent.addEventListener('scroll', this.scrollListener!);
    });
  }

  private setup(): void {
    this.setupSticky();
    this.setupSizeMirroring();
    this.setupClickEventMirroring();
    this.setupHorizontalScrollMirroring();
  }

  private setupSizeMirroring(): void {
    this.sizeListener = () => {
      window.requestAnimationFrame(() => {
        const headerSize = this.header.getBoundingClientRect().width;
        this.cloneContainer.style.width = `${headerSize}px`;
        this.cloneContainerParent.style.top = `${this.getTop()}px`;
        this.setHorizontalScrollOnClone();
      });
    };
    window.addEventListener('resize', this.sizeListener);
  }

  private setupHorizontalScrollMirroring(): void {
    this.containerScrollListener = () => {
      window.requestAnimationFrame(() => {
        this.setHorizontalScrollOnClone();
      });
    };
    this.tableContainerParent.addEventListener('scroll', this.containerScrollListener);
  }

  private createClone(): HTMLTableRowElement {
    const clone = this.header.cloneNode(true) as HTMLTableRowElement;
    this.cloneContainer.append(clone);

    const headerSize = this.header.getBoundingClientRect().width;

    Array.from(this.header.children).forEach((row, rowIndex) => {
      Array.from(row.children).forEach((cell, index) => {
          (clone.children[rowIndex].children[index] as HTMLTableCellElement).style.width =
            (cell.getBoundingClientRect().width / headerSize) * 100 + '%';
      });
    });

    this.cloneContainer.style.display = 'table';
    this.cloneContainer.style.width = `${headerSize}px`;

    this.cloneContainerParent.style.position = 'fixed';
    this.cloneContainerParent.style.overflow = 'hidden';
    this.cloneContainerParent.style.top = `${this.getTop()}px`;

    this.setHorizontalScrollOnClone();

    return clone;
  }

  private setHorizontalScrollOnClone(): void {
    this.cloneContainerParent.style.width = `${this.tableContainerParent.getBoundingClientRect().width}px`;
    this.cloneContainerParent.scrollLeft = this.tableContainerParent.scrollLeft;
  }

  private sizeToPx(size: number | string): number {
    if (typeof size === 'number') {
      return size;
    } else if (size.match(/rem$/)) {
      const rem = +size.replace(/rem$/, '');
      return Number.parseFloat(
        window.getComputedStyle(document.getElementsByTagName('html')[0]).fontSize
      ) * rem;
    } else {
      console.error('Unsupported size format for sticky table header displacement.');
      return 0;
    }
  }

  private getTop(): number {
    const windowWidth = document.body.getBoundingClientRect().width;
    const sizes = Object.entries(this.top)
      .filter(([key]) => key !== 'max')
      .sort(([key1], [key2]) => Number.parseInt(key1, 10) - Number.parseInt(key2, 10));

    for (let i = 0, size; (size = sizes[i++]); ) {
      if (windowWidth < Number.parseInt(size[0], 10)) {
        return this.sizeToPx(size[1]);
      }
    }

    const top = this.sizeToPx(this.top.max);
    const parentTops = this.scrollParents.map((c) => c.getBoundingClientRect().top)

    return Math.max(top, ...parentTops);
  }

  private getBottom(): number {
    const tableRect = this.tableContainer.getBoundingClientRect();
    const lastElement = this.getLastElement();
    const headerHeight = this.header.getBoundingClientRect().height;

    const defaultBottom = (lastElement ? lastElement.getBoundingClientRect().y : tableRect.y + tableRect.height) - headerHeight;
    const parentBottoms = this.scrollParents.map((c) =>
      c.getBoundingClientRect().bottom - 2 * headerHeight)
    return Math.min(defaultBottom, ...parentBottoms, Number.MAX_VALUE);
  }

  private getLastElement() {
    if (!this.lastElement) {
      this.lastElement = this.tableContainer.querySelector(':scope > tbody > tr:last-child');
      return this.lastElement;
    }

    if (this.lastElementRefresh) {
      clearTimeout(this.lastElementRefresh);
    }
    this.lastElementRefresh = setTimeout(() => this.lastElement, 2000);
    return this.lastElement;
  }
}
