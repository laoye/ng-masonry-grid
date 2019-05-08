import {APP_INITIALIZER, NgModule} from '@angular/core';
import {NgMasonryGridPlusDirective} from './ng-masonry-grid-plus.directive';

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
    NgMasonryGridPlusDirective
  ],
  imports: [],
  exports: [
    NgMasonryGridPlusDirective
  ],
  providers: [
    {provide: APP_INITIALIZER, useFactory: masonryGridInit, deps: [], multi: true}
  ]
})
export class NgMasonryGridPlusModule {
}
