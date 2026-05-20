import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DestinationVerticalList } from './destination-vertical-list';

describe('DestinationVerticalList', () => {
  let component: DestinationVerticalList;
  let fixture: ComponentFixture<DestinationVerticalList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DestinationVerticalList],
    }).compileComponents();

    fixture = TestBed.createComponent(DestinationVerticalList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
