# NASA and ESA Data Projects · Mars Data · Mars calendar · © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Solar longitude (Ls, the Martian season) and Mars Year from a date, by the method of Allison and McEwen (2000),
# "A post-Pathfinder evaluation of areocentric solar coordinates", Planetary and Space Science 48, 215-235, the method
# used by NASA GISS's Mars24 Sunclock. Mars Years are numbered from Year 1, which began at Ls 0 on April 11, 1955
# (Clancy et al., 2000). Accuracy: about 0.01 degree of Ls, far finer than one sol (about 0.5 degree).
import math
from datetime import datetime, timezone

J2000 = datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
TT_MINUS_UTC = 69.184  # seconds, for dates after 2017 (37 leap seconds + 32.184); under 1 s of Ls error before then

_PBS = [  # perturbations by the other planets: amplitude (deg), period (Julian years), phase (deg)
    (0.0071, 2.2353, 49.409), (0.0057, 2.7543, 168.173), (0.0039, 1.1177, 191.837), (0.0037, 15.7866, 21.736),
    (0.0021, 2.1354, 15.704), (0.0020, 2.4694, 95.528), (0.0018, 32.8493, 49.095)]


def _ls_unwrapped(days_tt: float) -> float:
    """Ls in degrees, not wrapped to 0-360, for days (TT) since J2000."""
    m = math.radians(19.3871 + 0.52402073 * days_tt)
    alpha_fms = 270.3871 + 0.524038496 * days_tt
    pbs = sum(a * math.cos(math.radians(0.985626 * days_tt / tau + phi)) for a, tau, phi in _PBS)
    eq_centre = ((10.691 + 3.0e-7 * days_tt) * math.sin(m) + 0.623 * math.sin(2 * m) + 0.050 * math.sin(3 * m)
                 + 0.005 * math.sin(4 * m) + 0.0005 * math.sin(5 * m) + pbs)
    return alpha_fms + eq_centre


def _days_tt(t: datetime) -> float:
    return ((t - J2000).total_seconds() + TT_MINUS_UTC) / 86400.0


_MY1_START = _ls_unwrapped(_days_tt(datetime(1955, 4, 11, tzinfo=timezone.utc)))
_MY1_BASE = round(_MY1_START / 360.0) * 360.0  # the multiple of 360 degrees reached at the start of Mars Year 1


def ls_and_year(t: datetime) -> tuple[float, int]:
    """(Ls in degrees 0-360, Mars Year) for a UTC datetime."""
    u = _ls_unwrapped(_days_tt(t)) - _MY1_BASE
    return u % 360.0, int(u // 360.0) + 1


def from_j2000_seconds(seconds: float) -> datetime:
    """REMS TIMESTAMP (seconds since noon, January 1, 2000) to a UTC datetime (leap seconds ignored: under 1 minute)."""
    return datetime.fromtimestamp(J2000.timestamp() + seconds, tz=timezone.utc)
