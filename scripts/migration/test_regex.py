import re
from datetime import datetime, timezone

def extract_date(filename):
    # Pattern 1: YYYY-MM-DD or YYYY-MM-unknown or YYYY-unknown
    # Examples: 1983-09-unknown, 1968-unknown
    m = re.search(r'((19|20)\d{2})-(0[1-9]|1[0-2]|unknown)?-(0[1-9]|[12]\d|3[01]|unknown)?', filename)
    if m:
        year = int(m.group(1))
        month = m.group(3)
        day = m.group(4)
        
        precision = 'exact'
        if month == 'unknown' or month is None:
            month = 1
            day = 1
            precision = 'year'
        else:
            month = int(month)
            if day == 'unknown' or day is None:
                day = 1
                precision = 'month'
            else:
                day = int(day)
                precision = 'day'
                
        return datetime(year, month, day, tzinfo=timezone.utc), precision

    # Pattern 2: YYYYMMDD_HHMMSS or IMG_YYYYMMDD
    m = re.search(r'((19|20)\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])_(\d{6})?', filename)
    if m:
        year = int(m.group(1))
        month = int(m.group(3))
        day = int(m.group(4))
        return datetime(year, month, day, tzinfo=timezone.utc), 'exact'

    # Pattern 3: Unix Epoch (ms) e.g., 1520366320366
    m = re.search(r'(1[0-7]\d{11})', filename)
    if m:
        epoch_ms = int(m.group(1))
        dt = datetime.fromtimestamp(epoch_ms / 1000.0, tz=timezone.utc)
        return dt, 'exact'

    return None, None

names = [
    "IMG_1520366320366.jpg",
    "IMG_20171018_164519746_LL.jpg",
    "20240921_124303.jpg",
    "1983-09-unknown__ECC-Eric-with-Container-Garden_1.jpg",
    "1968-unknown-unknown.jpg",
    "FB_IMG_1778011413703.jpg",
    "20260508_153512.jpg"
]

for name in names:
    dt, prec = extract_date(name)
    if dt:
        print(f"{name} -> {dt.isoformat()} ({prec})")
    else:
        print(f"{name} -> No match")
