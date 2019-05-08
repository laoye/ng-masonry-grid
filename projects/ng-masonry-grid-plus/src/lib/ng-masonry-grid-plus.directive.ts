import {
  Directive,
  ElementRef,
  EventEmitter, HostListener,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChange,
  SimpleChanges
} from '@angular/core';
import {noop} from 'rxjs';

interface MasonryGridOptions {
  gridWidth: number;
  gutterSize: number;
  gridNo: number | 'auto';
  direction: 'ltor' | 'rtol';
  refreshOnImgLoad: boolean;
  cssGrid: boolean;
  performantScroll: boolean;
  pageSize: number | 'auto';
  scrollContainer: string;
  infiniteScrollDelay: number;
  infiniteScrollDistance: number;
}

function nextTick() {
  return Promise.resolve();
}

@Directive({
  selector: '[masonry-grid]'
})
export class NgMasonryGridPlusDirective implements OnInit, OnChanges {

  @Input('mg-model') mgModel: string[];

  @Input('mg-options') mgOptions: MasonryGridOptions;

  @Output() infiniteScroll: EventEmitter<any>;

  private scrollNamespace: any = {};
  private $element: JQuery<HTMLElement>;
  private listElements: JQuery<HTMLElement>;
  private reflowCount = 0;
  private lastDomWidth: number;
  private timeoutPromise: number;

  constructor(private el: ElementRef) {
    this.$element = $(el.nativeElement);
    this.$element.addClass('masonry-grid');
    this.lastDomWidth = el.nativeElement.offsetWidth;
  }

  ngOnInit(): void {
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.mgOptions) {
      this.mgOptionsChange(changes.mgOptions);
    }
    if (changes.mgModel) {
      this.mgModelChange();
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.scrollNamespace.isBusy = true;
    const containerWidth = this.el.nativeElement.offsetWidth;
    if (this.lastDomWidth === containerWidth) {
      return;
    }
    this.lastDomWidth = containerWidth;

    if (this.timeoutPromise) {
      window.clearTimeout(this.timeoutPromise);
    }

    this.timeoutPromise = window.setTimeout(() => {
      if (this.mgOptions.performantScroll) {
        this.$element.children().detach();
        this.$element.append(this.listElements);
      }
      this.reflowGrids();
    }, 100);
  }

  private mgOptionsChange(change: SimpleChange) {
    const defaultValue: MasonryGridOptions = {
      gridWidth: 300,
      gutterSize: 10,
      gridNo: 'auto',
      direction: 'ltor',
      refreshOnImgLoad: true,
      cssGrid: false,
      performantScroll: false,
      pageSize: 'auto',
      scrollContainer: 'body',
      infiniteScrollDelay: 3000,
      infiniteScrollDistance: 100,
    };
    this.mgOptions = Object.assign({}, defaultValue, change.currentValue);
    if (this.mgOptions.cssGrid) {
      this.mgOptions.gutterSize = 0;
    }
    if (this.mgOptions.pageSize === 'auto') {
      this.mgOptions.pageSize = $(window).width() >= 768 ? 2 : 3;
    }
    if (this.listElements) {
      this.reflowGrids();
    }
  }

  private mgModelChange() {
    this.scrollNamespace.isBusy = true;
    // await nextTick();
    window.setTimeout(async () => {
      this.getListElements();
      await this.checkAnimate();
      this.handleImage();
      await nextTick();
      this.reflowGrids();
    });
  }

  private getListElements() {
    this.listElements = $(
      this.$element.children().toArray().filter(element => !$(element).hasClass('mg-clone'))
    );
  }

  private checkAnimate() {
    const leavingElements = this.listElements.toArray().filter(listItem => $(listItem).hasClass('ng-leave'));
    return new Promise(resolve => {
      if (!leavingElements.length) {
        resolve();
      } else {
        $(leavingElements[0]).one('webkitTransitionEnd transitionend msTransitionEnd oTransitionEnd', () => {
          window.setTimeout(() => {
            this.getListElements();
            resolve();
          });
        });
      }
    });
  }

  private handleImage() {
    let reflowPending = false;
    this.listElements.toArray().forEach(listItem => {
      const $listItem = $(listItem);
      const allImg = $listItem.find('img');
      if (!allImg.length) {
        return;
      }
      $listItem.addClass('img-loading');
      this.afterImageLoad($listItem, {
        beforeLoad: img => $(img).addClass('img-loading'),
        isLoaded: img => $(img).removeClass('img-loading').addClass('img-loaded'),
        onLoad: img => {
          if (!reflowPending && this.mgOptions.refreshOnImgLoad) {
            reflowPending = true;
            window.setTimeout(() => {
              this.reflowGrids();
              reflowPending = false;
            }, 100);
          }
          $(img).removeClass('img-loading').addClass('img-loaded');
        },
        onFullLoad: () => $listItem.removeClass('img-loading').addClass('img-loaded')
      });
    });
  }

  private reflowGrids() {
    if (!(this.listElements && this.listElements.length)) {
      return;
    }
    this.reflowCount++;

    const {colWidth, cols} = this.getColInfo();
    if (!cols) {
      return;
    }

    const lastRowBottom = [];
    for (let i = 0; i < cols; i++) {
      lastRowBottom.push(0);
    }

    this.listElements.toArray().forEach(listItem => {
      const $listItem = $(listItem);
      $listItem.addClass('mg-no-transition');
      $listItem.css('width', colWidth + 'px');
      const allImg = $listItem.find('img');
      allImg.toArray().forEach((img: HTMLImageElement) => {
        const $img = $(img);
        if ($img.hasClass('img-loaded')) {
          $img.css('height', '');
          return;
        }
        const actualWidth = $img.attr('actual-width') || $img.attr('data-actual-width');
        const actualHeight = $img.attr('actual-height') || $img.attr('data-actual-height');
        if (actualWidth && actualHeight) {
          $img.css('height', (parseInt(actualHeight, 10) * img.width / parseInt(actualWidth, 10)) + 'px');
        }
      });
      $listItem.removeClass('mg-no-transition');
    });

    const clones = this.listElements.clone();
    clones.addClass('mg-no-transition mg-clone');
    clones.css({
      visibility: 'hidden',
      opacity: 0,
      top: 0,
      left: 0,
      width: colWidth + 'px'
    });
    this.$element.append(clones);

    const reflowIndex = this.reflowCount;
    this.afterImageLoad(clones, {
      ignoreCheck: img => !$(img).hasClass('img-loaded'),
      onFullLoad: () => {
        if (reflowIndex < this.reflowCount) {
          clones.remove();
          return;
        }

        const listElementsHeights = clones.toArray().map(clone => clone.offsetHeight);
        const listElementsPosInfo = this.listElements.toArray().map((listItem, i) => {
          const $listItem = $(listItem);
          const height = listElementsHeights[i];
          const top = Math.min(...lastRowBottom);
          const col = lastRowBottom.indexOf(top);

          lastRowBottom[col] = top + height + this.mgOptions.gutterSize;
          const posX = col * (colWidth + this.mgOptions.gutterSize);

          const cssObj: any = {
            position: 'absolute',
            top: top + 'px',
            width: colWidth + 'px'
          };
          if (this.mgOptions.direction === 'rtol') {
            cssObj.right = posX + 'px';
          } else {
            cssObj.left = posX + 'px';
          }
          $listItem.css(cssObj).addClass('masonry-grid-item');
          return {
            top,
            bottom: top + height
          };
        });

        const containerHeight = Math.max(...lastRowBottom);
        this.$element.css('height', containerHeight + 'px');

        clones.remove();

        if (this.mgOptions.performantScroll || this.infiniteScroll) {
          this.scrollNamespace.scrollContInfo = this.getScrollContainerInfo();
        }
        if (this.mgOptions.performantScroll) {
          this.scrollNamespace.lastPage = null;
          this.calculatePageInfo(listElementsPosInfo, containerHeight, cols);
          this.scrollNamespace.isBusy = false;
          this.refreshDomElm(this.scrollNamespace.lastScrollPosition || 0);
        }
        this.reEnableInfiniteScroll();
      }
    });

  }

  private getColInfo() {
    const containerWidth = this.el.nativeElement.offsetWidth;
    let colWidth: number;
    let cols: number;
    if (this.mgOptions.cssGrid) {
      const clone = $(this.listElements[0]).clone();
      clone.css({
        visibility: 'hidden',
        opacity: 0,
        top: 0,
        left: 0,
        width: ''
      }).addClass('mg-no-transition mg-clone');
      this.$element.append(clone);
      colWidth = clone[0].offsetWidth;
      cols = colWidth ? Math.floor((containerWidth + 12) / colWidth) : 0;
      clone.remove();
    } else {
      if (this.mgOptions.gridNo === 'auto') {
        colWidth = this.mgOptions.gridWidth;
        cols = Math.floor((containerWidth + this.mgOptions.gutterSize) / (colWidth + this.mgOptions.gutterSize));
      } else {
        colWidth = Math.floor(containerWidth / this.mgOptions.gridNo) - this.mgOptions.gutterSize;
        cols = this.mgOptions.gridNo;
      }
      const remainingSpace = ((containerWidth + this.mgOptions.gutterSize) % (colWidth + this.mgOptions.gutterSize));
      colWidth = colWidth + Math.floor(remainingSpace / cols);
    }
    return {
      cols,
      colWidth
    };
  }

  private getScrollContainerInfo() {
    const container = $(document.querySelector<HTMLElement>(this.mgOptions.scrollContainer));
    const containerElement = container[0];
    const $element = this.mgOptions.scrollContainer === 'body' ? $(window) : container;
    return {
      height: $element[0] === window ? window.innerHeight : ($element[0] as HTMLElement).offsetHeight,
      scrollHeight: containerElement.scrollHeight,
      startFrom: this.findPos(this.el.nativeElement, containerElement).top,
      $elm: $element
    };
  }

  private findPos(obj: HTMLElement, withRespectTo: HTMLElement) {
    withRespectTo = withRespectTo || document.body;
    let left = 0;
    let top = 0;
    if (obj.offsetParent) {
      do {
        left += obj.offsetLeft;
        top += obj.offsetTop;
        obj = obj.offsetParent as HTMLElement | null;
      } while (obj && obj !== withRespectTo);
    }
    return {
      left,
      top
    };
  }

  private calculatePageInfo(listElmPosInfo: any, scrollBodyHeight: any, colNo: number) {
    this.scrollNamespace.pageInfo = [{
      from: 0
    }];

    const pageSize = this.mgOptions.pageSize as number;
    const scrollContHeight = this.scrollNamespace.scrollContInfo.height;
    const pageHeight = scrollContHeight * pageSize;
    const totalPages = Math.ceil(scrollBodyHeight / pageHeight);

    for (let pageNo = 0; pageNo < totalPages; pageNo++) {
      for (let idx = 0, ln = listElmPosInfo.length; idx < ln; idx++) {
        const elmInfo = listElmPosInfo[idx];
        const from = pageNo ? pageHeight * pageNo : 0;
        const to = pageHeight * (pageNo + 1);

        if (elmInfo.bottom < from || elmInfo.top > to) {
          if (elmInfo.top > to) {
            break;
          }
        } else {
          if (!this.scrollNamespace.pageInfo[pageNo]) {
            this.scrollNamespace.pageInfo[pageNo] = {
              from: idx
            };
          }
          this.scrollNamespace.pageInfo[pageNo].to = idx;
        }
      }
    }

    this.scrollNamespace.pageInfo = this.scrollNamespace.pageInfo.map((page, idx) => {
      const fromPage = Math.max(idx - 1, 0);
      const toPage = Math.min(idx + 1, this.scrollNamespace.pageInfo.length - 1);
      return {
        from: this.scrollNamespace.pageInfo[fromPage].from,
        to: this.scrollNamespace.pageInfo[toPage].to
      };
    });
  }

  private refreshDomElm(scrollTop: number) {
    this.scrollNamespace.lastScrollPosition = scrollTop;
    let filteredElm;
    if (this.scrollNamespace.isBusy) {
      return;
    }
    let currentPage = 0;
    const pageSize = this.mgOptions.pageSize as number;

    if (scrollTop > this.scrollNamespace.scrollContInfo.startFrom + this.scrollNamespace.scrollContInfo.height * pageSize) {
      currentPage = Math.floor(
        (scrollTop - this.scrollNamespace.scrollContInfo.startFrom) / (this.scrollNamespace.scrollContInfo.height * pageSize)
      );
    }
    if (currentPage === this.scrollNamespace.lastPage) {
      return;
    }
    this.scrollNamespace.lastPage = currentPage;
    const curPageInfo = this.scrollNamespace.pageInfo[currentPage];

    if (curPageInfo) {
      this.$element.children().detach();
      filteredElm = Array.prototype.slice.call(this.listElements, curPageInfo.from, curPageInfo.to + 1);
      this.bindWatchersOnVisible(filteredElm);
      this.$element.append(filteredElm);
    }
  }

  private bindWatchersOnVisible(filteredElm: any) {
    // var itemData, $item, i, ln;
    // //unbind watchers from all element
    // for (i = 0, ln = listElms.length; i < ln; i++) {
    //   $item = single(listElms[i]);
    //   itemData = $item.data();
    //   if (itemData.$scope) {
    //     $item.data('_agOldWatchers', itemData.$scope.$$watchers);
    //     itemData.$scope.$$watchers = [];
    //   }
    // }
    //
    // //bind watchers on all visible element
    // for (i = 0, ln = visibleELm.length; i < ln; i++) {
    //   itemData = single(visibleELm[i]).data();
    //   if (itemData.$scope) {
    //     itemData.$scope.$$watchers = itemData._agOldWatchers || [];
    //     //trigger digest on each child scope
    //     itemData.$scope.$digest();
    //   }
    // }
  }

  private reEnableInfiniteScroll() {
    clearTimeout(this.scrollNamespace.infiniteScrollTimeout);
    this.scrollNamespace.isLoading = false;
  }

  private afterImageLoad(container: JQuery<HTMLElement>, options: any) {
    const beforeLoad = options.beforeLoad || noop;
    const onLoad = options.onLoad || noop;
    const isLoaded = options.isLoaded || noop;
    const onFullLoad = options.onFullLoad || noop;
    const ignoreCheck = options.ignoreCheck || noop;
    const allImg = container.find('img');
    const loadedImgPromises = [];

    allImg.toArray().forEach((img: HTMLImageElement) => {
      if (!img.src) {
        return;
      }
      beforeLoad(img);
      if (!img.complete && !ignoreCheck(img)) {
        loadedImgPromises.push(new Promise((resolve, reject) => {
          img.onload = () => {
            onLoad(img);
            resolve();
          };
          img.onerror = reject;
        }));
      } else {
        isLoaded(img);
      }
    });

    if (loadedImgPromises.length) {
      Promise.all(loadedImgPromises).then(onFullLoad, onFullLoad);
    } else {
      window.setTimeout(onFullLoad);
    }
  }


}
