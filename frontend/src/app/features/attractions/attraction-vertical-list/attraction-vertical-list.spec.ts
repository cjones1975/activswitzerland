import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AttractionVerticalList } from './attraction-vertical-list';

describe('AttractionVerticalList', () => {
  let component: AttractionVerticalList;
  let fixture: ComponentFixture<AttractionVerticalList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttractionVerticalList],
    }).compileComponents();

    fixture = TestBed.createComponent(AttractionVerticalList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
