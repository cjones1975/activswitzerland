import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DestinationHorizontalList } from './destination-horizontal-list';

describe('DestinationHorizontalList', () => {
  let component: DestinationHorizontalList;
  let fixture: ComponentFixture<DestinationHorizontalList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DestinationHorizontalList],
    }).compileComponents();

    fixture = TestBed.createComponent(DestinationHorizontalList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
