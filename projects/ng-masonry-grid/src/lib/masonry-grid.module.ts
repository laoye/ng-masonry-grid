import {APP_INITIALIZER, NgModule} from '@angular/core';
import {MasonryGridDirective} from './masonry-grid.directive';

export function masonryGridInit() {
  return masonryGridInitFn;

  function masonryGridInitFn() {
    $(document.head).append('<style>' +
      '.mg-no-transition{-webkit-transition: none !important;transition: none !important;} ' +
      '.masonry-grid{position : relative;} ' +
      '.masonry-grid > *{opacity : 0} ' +
      '.masonry-grid > .masonry-grid-item{opacity : 1}' +
      '</style>');
  }
}

@NgModule({
  declarations: [
    MasonryGridDirective
  ],
  imports: [],
  exports: [
    MasonryGridDirective
  ],
  providers: [
    {provide: APP_INITIALIZER, useFactory: masonryGridInit, deps: [], multi: true}
  ]
})
export class MasonryGridModule {
}
