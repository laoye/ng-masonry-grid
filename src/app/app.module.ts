import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';

import {AppComponent} from './app.component';
import {MasonryGridModule} from '../../projects/ng-masonry-grid-lib/src/lib/masonry-grid.module';
import {EzPlusModule} from 'ng-elevatezoom-plus';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    MasonryGridModule,
    EzPlusModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
